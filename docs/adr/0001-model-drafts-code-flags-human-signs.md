# The model drafts, deterministic checks flag, a human signs off

The model only proposes field values with a source quote; every check that can be code (grounding, NPI check digit, code formats, dates) is code, and it flags rather than corrects. Every order still gets a human sign-off in v1, flags only set review priority. We chose this over "auto-accept when confident" because a quiet mistake in an order is a patient-safety problem, and a model's self-reported confidence is not calibrated enough to remove the human.
