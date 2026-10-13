"""Turn raw text or an uploaded file into a clean list of single requirements."""
import csv
import io
import re
import zipfile

from docx import Document

MAX_REQ_CHARS = 1000
MAX_DOCX_UNCOMPRESSED = 30_000_000
_PREFIX = re.compile(r"^\s*(?:[-*•–]|\(?\d+(?:\.\d+)*[.)]|(?:REQ|FR|NFR|SR)[-_ ]?\d+[:.)-]?)\s*", re.I)
_CSV_COLUMNS = ("requirement", "requirements", "text", "description", "statement")


class ParseError(ValueError):
    pass


def split_requirements(text: str) -> list[str]:
    out = []
    for line in re.split(r"\r?\n+", text):
        line = _PREFIX.sub("", line).strip()
        if len(line) >= 3:
            out.append(line[:MAX_REQ_CHARS])
    return out


def _from_csv(data: bytes) -> list[str]:
    rows = list(csv.reader(io.StringIO(data.decode("utf-8-sig", errors="replace"))))
    if not rows:
        return []
    header = [h.strip().lower() for h in rows[0]]
    col = next((header.index(c) for c in _CSV_COLUMNS if c in header), None)
    body = rows[1:] if col is not None else rows
    col = col if col is not None else 0
    return [r[col] for r in body if len(r) > col and r[col].strip()]


def _from_docx(data: bytes) -> list[str]:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if sum(i.file_size for i in z.infolist()) > MAX_DOCX_UNCOMPRESSED:
                raise ParseError("The .docx file is too large once unpacked")
        doc = Document(io.BytesIO(data))
    except ParseError:
        raise
    except Exception as e:  # corrupt / not a docx
        raise ParseError("Could not read the .docx file") from e
    return [p.text for p in doc.paragraphs if p.text.strip()]


def parse_file(filename: str, data: bytes) -> list[str]:
    name = filename.lower()
    if name.endswith(".csv"):
        lines = _from_csv(data)
    elif name.endswith(".docx"):
        lines = _from_docx(data)
    elif name.endswith((".txt", ".md")):
        lines = [data.decode("utf-8", errors="replace")]
    else:
        raise ParseError("Unsupported file type. Use .txt, .md, .csv or .docx")
    return split_requirements("\n".join(lines))
