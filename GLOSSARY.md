# Order Intake

Turning inbound medical orders into draft, human-verified FHIR data for downstream patient matching.

## Documents

**Inbound document**:
Anything that arrives at central intake (fax, email attachment); we only see its text layer.
_Avoid_: File, PDF, upload

**Order**:
An inbound document that requests a service for a patient: lab, imaging, DME or referral.
_Avoid_: Request, requisition, script

**Not-an-order**:
An inbound document that is not an order (cover sheet, newsletter); it is archived with no extraction.
_Avoid_: Junk, spam, other

## Extraction

**Field**:
One of the eight values we extract from an order (see `FIELD_KEYS`).
_Avoid_: Attribute, property, slot

**Source quote**:
The verbatim span of the inbound document that a field's value was read from.
_Avoid_: Evidence, citation, snippet

**Abstain**:
Return `null` for a field because the order does not state it.
_Avoid_: Skip, empty, unknown

**Grounded**:
A field whose source quote appears verbatim in the inbound document. Grounded proves the quote exists, not that it is the right field.

## Review

**Flag**:
A machine-readable reason that routes a field to human review.
_Avoid_: Warning, error, alert

**Silent error**:
A field value that is wrong or ungrounded and carries no flag. The one failure we never accept.
_Avoid_: Bug, miss

**Review load**:
The share of orders with at least one flag. It trades off against silent errors.

## Delivery

**Golden set**:
The human-owned synthetic orders and their truth files under `evals/datasets/`.
_Avoid_: Test data, fixtures

**Baseline**:
The last eval metrics a human accepted; gates compare against it.

**Escalation**:
An agent stopping and handing a decision to the human via the `needs-human` PR label.
_Avoid_: Alert, page
