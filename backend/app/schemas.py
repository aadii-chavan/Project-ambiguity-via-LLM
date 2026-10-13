from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints

IssueType = Literal[
    "vague_term", "missing_actor", "unbounded_quantifier", "referential", "lexical",
    "syntactic", "conflicting_condition", "undefined_term", "open_ended", "non_testable",
]
Severity = Literal["low", "medium", "high"]
Decision = Literal["pending", "accepted", "rejected", "edited"]


class Issue(BaseModel):
    type: IssueType
    severity: Severity
    span: str
    start: int
    end: int
    explanation: str


class RequirementResult(BaseModel):
    id: str
    original: str
    is_ambiguous: bool
    issues: list[Issue] = []
    suggested_rewrite: Optional[str] = None
    clarifying_questions: list[str] = []
    confidence: float = Field(ge=0, le=1)
    quality_before: int = Field(ge=0, le=100)
    quality_after: int = Field(ge=0, le=100)
    decision: Decision = "pending"
    final_text: Optional[str] = None


class SessionStats(BaseModel):
    total: int
    ambiguous: int
    ambiguity_rate: float
    avg_quality_before: float
    avg_quality_after: float
    by_type: dict[str, int]
    by_severity: dict[str, int]


class Project(BaseModel):
    id: str
    name: str
    created_at: datetime
    session_count: int = 0


ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class ProjectCreate(BaseModel):
    name: ProjectName


class SearchHit(BaseModel):
    session_id: str
    session_name: str
    project_id: str
    project_name: str
    requirement_id: str
    original: str
    is_ambiguous: bool
    matched_in: Literal["original", "rewrite", "final"]
    created_at: datetime


class AnalysisSession(BaseModel):
    id: str
    project_id: str = ""
    created_at: datetime
    name: str
    summary: SessionStats
    requirements: list[RequirementResult]
    engine: Literal["llm", "rules"] = "llm"


class AnalyzeOptions(BaseModel):
    strictness: Literal["lenient", "balanced", "strict"] = "balanced"
    style: Literal["shall", "user_story", "free"] = "shall"
    glossary: Annotated[list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]], Field(max_length=50)] = []


class AnalyzeRequest(BaseModel):
    text: str = Field(max_length=200_000)
    project_id: Optional[str] = None
    options: AnalyzeOptions = AnalyzeOptions()


class DecisionUpdate(BaseModel):
    decision: Decision
    final_text: Optional[str] = None
