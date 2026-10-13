from app.prompts.templates import CORRECT_SYSTEM, CORRECT_TOOL, correct_user
from app.schemas import Issue
from app.services.llm_client import LLMClient


async def correct(llm: LLMClient, text: str, issues: list[Issue], style: str, glossary: list[str]) -> tuple[str | None, list[str]]:
    data = await llm.generate_json(CORRECT_SYSTEM, correct_user(text, [i.model_dump() for i in issues], style, glossary), CORRECT_TOOL)
    rewrite = str(data.get("rewrite", "")).strip()
    qs = [str(q).strip() for q in data.get("clarifying_questions", []) if str(q).strip()][:5]
    return (rewrite or None), qs
