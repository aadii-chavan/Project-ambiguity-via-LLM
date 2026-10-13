def prf(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f, 3), "tp": tp, "fp": fp, "fn": fn}


def binary(gold: list[bool], pred: list[bool]) -> dict:
    tp = sum(g and p for g, p in zip(gold, pred))
    fp = sum((not g) and p for g, p in zip(gold, pred))
    fn = sum(g and (not p) for g, p in zip(gold, pred))
    tn = len(gold) - tp - fp - fn
    out = prf(tp, fp, fn)
    out.update(tn=tn, accuracy=round((tp + tn) / len(gold), 3) if gold else 0.0)
    return out


def types_micro(gold: list[set[str]], pred: list[set[str]]) -> dict:
    tp = sum(len(g & p) for g, p in zip(gold, pred))
    fp = sum(len(p - g) for g, p in zip(gold, pred))
    fn = sum(len(g - p) for g, p in zip(gold, pred))
    return prf(tp, fp, fn)


def per_type(gold: list[set[str]], pred: list[set[str]]) -> dict[str, dict]:
    kinds = sorted(set().union(*gold, *pred)) if gold else []
    return {k: prf(sum(k in g and k in p for g, p in zip(gold, pred)),
                   sum(k not in g and k in p for g, p in zip(gold, pred)),
                   sum(k in g and k not in p for g, p in zip(gold, pred))) for k in kinds}
