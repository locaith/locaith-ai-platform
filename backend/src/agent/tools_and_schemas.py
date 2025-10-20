from typing import List
from pydantic import BaseModel, Field


class SearchQueryList(BaseModel):
    query: List[str] = Field(
        description="A list of search queries to be used for web research."
    )
    rationale: str = Field(
        description="A brief explanation of why these queries are relevant to the research topic."
    )


class Reflection(BaseModel):
    is_sufficient: bool = Field(
        description="Whether the provided summaries are sufficient to answer the user's question."
    )
    knowledge_gap: str = Field(
        description="A description of what information is missing or needs clarification."
    )
    follow_up_queries: List[str] = Field(
        description="A list of follow-up queries to address the knowledge gap."
    )


# Guild5: Planner schema for structured planning after research
class PlanStep(BaseModel):
    description: str = Field(description="Concrete step to achieve the objective")


class PlannerPlan(BaseModel):
    objective: str = Field(description="The main objective to accomplish based on the user's request")
    kind: str = Field(description="Task kind: one of 'code', 'analysis', or 'answer'")
    steps: List[PlanStep] = Field(description="Ordered steps to execute")
    acceptance_criteria: List[str] = Field(description="Criteria to judge whether the task is done")
