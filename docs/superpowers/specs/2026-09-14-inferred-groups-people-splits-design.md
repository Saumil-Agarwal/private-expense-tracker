# Inferred Groups, People, and Splits Design

## Goal

Creating an expense draft should populate the expense details, selected group, selected people, and proposed split whenever the user's text or receipt instructions provide that information. Users must also be able to select any saved person without first selecting one of that person's groups.

## Saved participant catalog

Add an authenticated people API that returns the owner's active people with the same stable public IDs used by group responses: the owner is `me`; other people use their persisted person ID. The expense entry screen loads saved groups and saved people once and keeps both catalogs available while the draft is edited.

Names are resolved after trimming whitespace and comparing case-insensitively. The first persisted display spelling remains visible. A group match supplies its full member list. A people-only match does not attach a group. Unknown or ambiguous names are not created or silently substituted during inference.

## Inference contract

Introduce a richer draft result alongside the existing expense fields. It can describe:

- a matched group name;
- participant names explicitly mentioned by the user;
- an equal split, exact rupee amounts, percentages, or an unresolved split;
- receipt items and personal-item flags when images are present.

Inference receives a compact catalog containing saved group names with member names plus saved standalone people. The model returns names rather than database IDs. Application code resolves names to IDs and performs all arithmetic and validation.

Text-only draft creation preserves the fast deterministic expense parser, then interprets explicit split wording against the same catalog. The on-device model and receipt model use the richer structured result directly. A named group with no narrower participant list selects every group member. Explicit participant names select only those people, whether or not a group is attached.

## Split calculation and safety

All confirmed allocations are produced by domain calculation code, never trusted directly from model arithmetic.

- Equal splits use deterministic paise remainder handling.
- Exact rupee amounts must total the expense amount.
- Percentages must total 100 and are converted to paise with deterministic remainder handling.
- Personal receipt items are added to the owner's share of the shared remainder.
- Missing, unknown, or ambiguous participants keep the draft in `needs_review` while retaining recognized selections.
- A model-supplied group is accepted only when it matches a saved group.

The existing confirmed-expense schema remains the final persistence boundary and continues to require allocations to equal the expense total.

## Expense editor behavior

Make group selection controlled by the expense entry screen so inferred groups appear selected automatically. Selecting or changing a group updates the available split participants to that group's members. An inferred people-only split leaves the group selector at “No saved group” and selects the matched saved people.

The split editor accepts initial selected people and initial allocations. It displays the proposal immediately and remains fully editable. Add an existing-person selector populated from the saved people catalog, while retaining manual name entry for genuinely new people. The same person cannot be added twice under different casing.

Changing the group or participant set invalidates allocations that no longer apply and leaves the split for review until the user chooses equal, exact, personal, or decide-later behavior again.

## APIs and privacy

Saved catalogs are read through local owner-scoped APIs. Receipt inference obtains the catalog server-side; text and on-device inference use the already loaded catalog in the browser. Existing network policy remains unchanged: receipt inference talks only to local Ollama, and on-device inference stays in the browser.

No database identifiers are included in model prompts. No participant is created merely because a model emitted an unknown name.

## Error handling

Failure to load groups or people must not discard the typed expense or receipt queue. The editor shows a catalog warning and still permits manual review. Invalid structured model output follows the existing inference error path. A partially recognized split remains editable and visibly marked for review.

## Testing and verification

Implementation is test-driven and covers:

- case-insensitive group and people resolution;
- named-group equal splits;
- standalone saved-person equal and exact splits;
- unknown and ambiguous names producing review state;
- receipt inference using persisted groups rather than hard-coded groups;
- inferred group selection and editable proposed allocations in the expense entry UI;
- selecting an existing person from the split editor;
- saving stable group and person IDs;
- preservation of current manual, receipt, privacy, and reconciliation behavior.

Before pushing `main`, run the complete unit suite, lint, and production build.
