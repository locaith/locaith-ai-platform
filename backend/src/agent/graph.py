import os

from agent.tools_and_schemas import SearchQueryList, Reflection, PlannerPlan
from dotenv import load_dotenv
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage
from langgraph.types import Send
from langgraph.graph import StateGraph
from langgraph.graph import START, END
from langchain_core.runnables import RunnableConfig
from google.genai import Client

from agent.state import (
    OverallState,
    QueryGenerationState,
    ReflectionState,
    WebSearchState,
)
from agent.configuration import Configuration
from agent.prompts import (
    get_current_date,
    query_writer_instructions,
    web_searcher_instructions,
    reflection_instructions,
    answer_instructions,
)
from langchain_google_genai import ChatGoogleGenerativeAI
from agent.utils import (
    get_citations,
    get_research_topic,
    insert_citation_markers,
    resolve_urls,
)
from policy.loader import get_system_preamble

load_dotenv()

if os.getenv("GEMINI_API_KEY") is None:
    raise ValueError("GEMINI_API_KEY is not set")

# Used for Google Search API
genai_client = Client(api_key=os.getenv("GEMINI_API_KEY"))


# Nodes
def generate_query(state: OverallState, config: RunnableConfig) -> QueryGenerationState:
    """LangGraph node that generates search queries based on the User's question.

    Uses Gemini 2.0 Flash to create an optimized search queries for web research based on
    the User's question.

    Args:
        state: Current graph state containing the User's question
        config: Configuration for the runnable, including LLM provider settings

    Returns:
        Dictionary with state update, including search_query key containing the generated queries
    """
    configurable = Configuration.from_runnable_config(config)

    # check for custom initial search query count
    if state.get("initial_search_query_count") is None:
        state["initial_search_query_count"] = configurable.number_of_initial_queries

    # init Gemini 2.0 Flash
    llm = ChatGoogleGenerativeAI(
        model=configurable.query_generator_model,
        temperature=1.0,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    structured_llm = llm.with_structured_output(SearchQueryList)

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = query_writer_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        number_queries=state["initial_search_query_count"],
    )
    # Generate the search queries
    result = structured_llm.invoke(formatted_prompt)
    return {"generate_query": {"search_query": result.query}, "search_query": result.query}


def continue_to_web_research(state: QueryGenerationState):
    """LangGraph node that sends the search queries to the web research node.

    This is used to spawn n number of web research nodes, one for each search query.
    """
    return [
        Send("web_research", {"search_query": search_query, "id": int(idx)})
        for idx, search_query in enumerate(state["search_query"])
    ]


def web_research(state: WebSearchState, config: RunnableConfig) -> OverallState:
    """LangGraph node that performs web research using the native Google Search API tool.

    Executes a web search using the native Google Search API tool in combination with Gemini 2.0 Flash.

    Args:
        state: Current graph state containing the search query and research loop count
        config: Configuration for the runnable, including search API settings

    Returns:
        Dictionary with state update, including sources_gathered, research_loop_count, and web_research_results
    """
    # Configure
    configurable = Configuration.from_runnable_config(config)
    formatted_prompt = web_searcher_instructions.format(
        current_date=get_current_date(),
        research_topic=state["search_query"],
    )

    # Uses the google genai client as the langchain client doesn't return grounding metadata
    response = genai_client.models.generate_content(
        model=configurable.query_generator_model,
        contents=formatted_prompt,
        config={
            "tools": [{"google_search": {}}],
            "temperature": 0,
        },
    )
    # resolve the urls to short urls for saving tokens and time
    resolved_urls = resolve_urls(
        response.candidates[0].grounding_metadata.grounding_chunks, state["id"]
    )
    # Gets the citations and adds them to the generated text
    citations = get_citations(response, resolved_urls)
    modified_text = insert_citation_markers(response.text, citations)
    sources_gathered = [item for citation in citations for item in citation["segments"]]

    return {
        "web_research": {"sources_gathered": sources_gathered},
        "sources_gathered": sources_gathered,
        "search_query": [state["search_query"]],
        "web_research_result": [modified_text],
    }


def reflection(state: OverallState, config: RunnableConfig) -> ReflectionState:
    """LangGraph node that identifies knowledge gaps and generates potential follow-up queries.

    Analyzes the current summary to identify areas for further research and generates
    potential follow-up queries. Uses structured output to extract
    the follow-up query in JSON format.

    Args:
        state: Current graph state containing the running summary and research topic
        config: Configuration for the runnable, including LLM provider settings

    Returns:
        Dictionary with state update, including search_query key containing the generated follow-up query
    """
    configurable = Configuration.from_runnable_config(config)
    # Increment the research loop count and get the reasoning model
    state["research_loop_count"] = state.get("research_loop_count", 0) + 1
    reasoning_model = state.get("reasoning_model", configurable.reflection_model)

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = reflection_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        summaries="\n\n---\n\n".join(state["web_research_result"]),
    )
    # init Reasoning Model
    llm = ChatGoogleGenerativeAI(
        model=reasoning_model,
        temperature=1.0,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    result = llm.with_structured_output(Reflection).invoke(formatted_prompt)

    return {
        "reflection": {"is_sufficient": result.is_sufficient},
        "is_sufficient": result.is_sufficient,
        "knowledge_gap": result.knowledge_gap,
        "follow_up_queries": result.follow_up_queries,
        "research_loop_count": state["research_loop_count"],
        "number_of_ran_queries": len(state["search_query"]),
    }


def evaluate_research(
    state: ReflectionState,
    config: RunnableConfig,
) -> OverallState:
    """LangGraph routing function that determines the next step in the research flow.

    Controls the research loop by deciding whether to continue gathering information
    or to finalize the summary based on the configured maximum number of research loops.

    Args:
        state: Current graph state containing the research loop count
        config: Configuration for the runnable, including max_research_loops setting

    Returns:
        String literal indicating the next node to visit ("web_research" or "finalize_summary")
    """
    configurable = Configuration.from_runnable_config(config)
    max_research_loops = (
        state.get("max_research_loops")
        if state.get("max_research_loops") is not None
        else configurable.max_research_loops
    )
    if state["is_sufficient"] or state["research_loop_count"] >= max_research_loops:
        # Guild5: when sufficient, move to planner instead of finalizing immediately
        return "planner"
    else:
        # Limit to only 1 follow-up query per loop for performance optimization
        # Take the first (most important) follow-up query only
        if state["follow_up_queries"]:
            return [
                Send(
                    "web_research",
                    {
                        "search_query": state["follow_up_queries"][0],  # Only first query
                        "id": state["number_of_ran_queries"],
                    },
                )
            ]
        else:
            return "planner"


# Guild5: Planner node

def planner(state: OverallState, config: RunnableConfig) -> OverallState:
    configurable = Configuration.from_runnable_config(config)
    reasoning_model = state.get("reasoning_model") or configurable.answer_model

    llm = ChatGoogleGenerativeAI(
        model=reasoning_model,
        temperature=0.3,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    system_preamble = get_system_preamble()
    user_prompt = (
        f"You are a planner. Based on the user's request and the gathered summaries, "
        f"produce a JSON plan with fields: objective, kind (code|analysis|answer), "
        f"steps (each with description), and acceptance_criteria. \n\n"
        f"User request: {get_research_topic(state['messages'])}\n\n"
        f"Summaries: {'\n---\n'.join(state.get('web_research_result', []) or [])}"
    )
    plan = llm.with_structured_output(PlannerPlan).invoke([
        SystemMessage(content=system_preamble),
        HumanMessage(content=user_prompt),
    ])

    return {
        "planner": {"plan": plan.model_dump()},
        "plan": plan.model_dump(),
        "task_kind": plan.kind,
    }


# Guild5: Actor node

def actor(state: OverallState, config: RunnableConfig) -> OverallState:
    configurable = Configuration.from_runnable_config(config)
    reasoning_model = state.get("reasoning_model") or configurable.answer_model
    kind = (state.get("task_kind") or "answer").lower()

    llm = ChatGoogleGenerativeAI(
        model=reasoning_model,
        temperature=0.2,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )

    system_preamble = get_system_preamble()
    base_instruction = (
        "You are the actor. Follow the plan to produce artifacts. "
        "Return a concise artifact suitable for streaming."
    )
    if kind == "code":
        user_prompt = (
            f"Task: write minimal code snippet to address the request.\n"
            f"Objective: {state.get('plan', {}).get('objective', '')}\n"
            f"Steps: {[s.get('description') for s in state.get('plan', {}).get('steps', [])]}\n"
            f"Provide code in Markdown fenced block with language, and a short title."
        )
    elif kind == "analysis":
        user_prompt = (
            f"Task: produce a short analytical write-up (Markdown) addressing the request.\n"
            f"Objective: {state.get('plan', {}).get('objective', '')}\n"
            f"Steps: {[s.get('description') for s in state.get('plan', {}).get('steps', [])]}\n"
            f"Include bullet points and a brief conclusion."
        )
    else:
        user_prompt = (
            f"Task: draft a concise answer to the user's request.\n"
            f"Objective: {state.get('plan', {}).get('objective', '')}\n"
            f"Steps: {[s.get('description') for s in state.get('plan', {}).get('steps', [])]}\n"
            f"Keep it short and clear."
        )

    result = llm.invoke([
        SystemMessage(content=system_preamble),
        HumanMessage(content=f"{base_instruction}\n\n{user_prompt}"),
    ])

    # Create a single artifact
    artifact = {
        "id": "artifact-1",
        "title": "Code Snippet" if kind == "code" else ("Analysis" if kind == "analysis" else "Draft Answer"),
        "mime": "text/markdown",
        "content": result.content,
    }

    return {
        "actor": {"artifacts": [artifact]},
        "artifacts": [artifact],
    }


# Guild5: Self-check node

def self_check(state: OverallState, config: RunnableConfig) -> OverallState:
    configurable = Configuration.from_runnable_config(config)
    reasoning_model = state.get("reasoning_model") or configurable.answer_model
    llm = ChatGoogleGenerativeAI(
        model=reasoning_model,
        temperature=0.2,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )

    content = (state.get("artifacts") or [{}])[0].get("content", "")
    feedback_prompt = (
        "Perform a self-check of the artifact. Respond with 2-3 bullet points of feedback and any quick fixes."
    )
    res = llm.invoke(feedback_prompt + "\n\nArtifact:\n" + content)

    return {
        "self_check": {"feedback": res.content},
        "self_check_feedback": res.content,
    }


def finalize_answer(state: OverallState, config: RunnableConfig):
    """LangGraph node that finalizes the research summary.

    Prepares the final output by deduplicating and formatting sources, then
    combining them with the running summary to create a well-structured
    research report with proper citations.

    Args:
        state: Current graph state containing the running summary and sources gathered

    Returns:
        Dictionary with state update, including running_summary key containing the formatted final summary with sources
    """
    configurable = Configuration.from_runnable_config(config)
    reasoning_model = state.get("reasoning_model") or configurable.answer_model

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = answer_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        summaries="\n---\n\n".join(state.get("web_research_result", [])),
    )

    # init Reasoning Model, default to Gemini 2.5 Flash
    llm = ChatGoogleGenerativeAI(
        model=reasoning_model,
        temperature=0,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    result = llm.invoke(formatted_prompt)

    # Replace the short urls with the original urls and add all used urls to the sources_gathered
    unique_sources = []
    for source in state.get("sources_gathered", []):
        if source["short_url"] in result.content:
            result.content = result.content.replace(
                source["short_url"], source["value"]
            )
            unique_sources.append(source)

    return {
        "finalize_answer": {"status": "done"},
        "messages": [AIMessage(content=result.content)],
        "sources_gathered": unique_sources,
    }


# Routing logic: decide mode based on the user's prompt

def route_mode(state: OverallState, config: RunnableConfig):
    """Auto router giữa web search và trả lời trực tiếp bằng LLM.

    Nếu câu hỏi có tính thời sự/thời gian thực (ví dụ: "hôm nay là ngày gì"), bắt buộc dùng web search.
    Ngược lại, nếu là trò chuyện thông thường, dùng LLM trực tiếp.
    """
    q = (get_research_topic(state["messages"]) or "").lower().strip()

    # Các từ khóa nhận diện câu hỏi thời gian thực hoặc phụ thuộc dữ liệu cập nhật
    time_keywords = [
        "hôm nay", "today", "hiện tại", "bây giờ", "mới nhất",
        "tuần này", "tháng này", "năm nay",
        "lịch", "calendar", "ngày", "ngày gì", "holiday", "lễ",
        "event", "festival", "sự kiện", "đang diễn ra",
        "thời tiết", "weather", "giá", "price", "cổ phiếu", "stock", "tỷ giá", "exchange rate",
        "ở việt nam", "tại việt nam", "vn"
    ]
    if any(k in q for k in time_keywords):
        return "generate_query"

    # Từ khóa tri thức/hỏi đáp phổ biến -> ưu tiên tìm kiếm
    keywords = [
        "tin", "news", "ai là", "what", "when", "where", "who",
        "định nghĩa", "nguồn", "website", "so sánh",
    ]
    if any(k in q for k in keywords):
        return "generate_query"

    # Nếu có chỉ dấu năm/thời điểm cụ thể -> ưu tiên search
    import re
    if re.search(r"\b20\d{2}\b", q) or re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", q):
        return "generate_query"

    return "llm"


# Direct LLM node (Gemini 2.5 Flash)

def node_llm(state: OverallState, config: RunnableConfig) -> OverallState:
    """Answer directly using Gemini 2.5 Flash without web search."""
    # Always use Gemini 2.5 Flash for casual chat
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
        max_retries=2,
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    user_prompt = get_research_topic(state["messages"]) or ""
    system_preamble = get_system_preamble()
    result = llm.invoke([
        SystemMessage(content=system_preamble),
        HumanMessage(content=user_prompt),
    ])

    # Return an AI message; no sources for direct LLM mode
    return {
        "llm": {"model": "gemini-2.5-flash"},
        "messages": [AIMessage(content=result.content)],
        "sources_gathered": [],
    }


# Create our Agent Graph
builder = StateGraph(OverallState, config_schema=Configuration)

# Define the nodes we will cycle between
builder.add_node("generate_query", generate_query)
builder.add_node("web_research", web_research)
builder.add_node("reflection", reflection)
# Guild5 nodes
builder.add_node("planner", planner)
builder.add_node("actor", actor)
builder.add_node("self_check", self_check)
builder.add_node("finalize_answer", finalize_answer)
# Add direct LLM node
builder.add_node("llm", node_llm)

# Start at route_mode to decide the path
builder.add_node("route_mode", lambda state: state)
builder.add_edge(START, "route_mode")
# Route to either search or llm
builder.add_conditional_edges("route_mode", route_mode, ["generate_query", "llm"])

# Add conditional edge to continue with search queries in a parallel branch
builder.add_conditional_edges(
    "generate_query", continue_to_web_research, ["web_research"]
)
# Reflect on the web research
builder.add_edge("web_research", "reflection")
# Evaluate the research
builder.add_conditional_edges(
    "reflection", evaluate_research, ["web_research", "planner"]
)
# Guild5 flow: planner -> actor -> self_check -> finalize
builder.add_edge("planner", "actor")
builder.add_edge("actor", "self_check")
builder.add_edge("self_check", "finalize_answer")
# Finalize the answer
builder.add_edge("finalize_answer", END)
# Direct LLM path ends the graph
builder.add_edge("llm", END)

graph = builder.compile(name="pro-search-agent")
