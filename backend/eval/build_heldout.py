"""Held-out set (30 items) written AFTER prompt tuning on dataset.jsonl; never used to tune prompts."""
import json
from pathlib import Path

AMB = [
    ("The system shall process payments quickly.", ["vague_term"]),
    ("The app should have a modern look.", ["vague_term", "non_testable"]),
    ("Orders shall be archived after completion.", ["missing_actor"]),
    ("The system shall support lots of products in the catalog.", ["unbounded_quantifier"]),
    ("Users may export their data in common formats.", ["open_ended", "non_testable"]),
    ("The system shall execute the order once the customer confirms.", ["lexical"]),
    ("The service shall drop invalid messages.", ["lexical"]),
    ("The manager shall approve the request of the employee after she completes the form.", ["referential"]),
    ("The gateway forwards the packet to the server, and it then acknowledges it.", ["referential"]),
    ("The system shall show old documents and files from last year.", ["syntactic"]),
    ("The system shall alert the supervisor if the temperature is high or the pressure is low and the valve is open.", ["conflicting_condition"]),
    ("Access shall be granted per company policy.", ["undefined_term", "missing_actor"]),
    ("VIP customers shall receive free shipping.", ["undefined_term"]),
    ("The system shall comply with applicable regulations.", ["undefined_term", "vague_term"]),
    ("The software shall provide appropriate error handling.", ["vague_term", "non_testable"]),
]
CLEAR = [
    "The system shall hash passwords using SHA-256 with a per-user salt.",
    "The system shall display a secure-connection icon in the browser address bar.",
    "The application shall send a push notification to the user 10 minutes before a scheduled appointment.",
    "The API shall accept requests with a JSON body no larger than 1 MB.",
    "The system shall allow a customer to add up to 50 items to a shopping cart.",
    "The report generator shall produce a PDF within 30 seconds for reports of up to 10,000 rows.",
    "The system shall prompt the user to confirm before deleting a project.",
    "The accountant shall be able to export the ledger as a CSV file.",
    "The system shall display prices in the currency selected in the user profile.",
    "The smart lock shall unlock the door when the registered phone is within 2 meters.",
    "The system shall block an IP address for 15 minutes after 10 failed login attempts from that address.",
    "The setup wizard shall consist of exactly four steps: license, location, options and confirmation.",
    "The system shall store each invoice for 10 years after its issue date.",
    "The system shall show the order status as one of: Pending, Shipped, Delivered or Cancelled.",
    "The system shall send a weekly summary email to every subscribed user on Mondays at 08:00 in the user's time zone.",
]
rows = [{"id": f"HA{i+1:02d}", "text": t, "ambiguous": True, "types": ty} for i, (t, ty) in enumerate(AMB)]
rows += [{"id": f"HC{i+1:02d}", "text": t, "ambiguous": False, "types": []} for i, t in enumerate(CLEAR)]
Path(__file__).with_name("heldout.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
print(len(rows), "held-out items")
