# Version and provenance freeze

Date recorded: 3 August 2026

## Current clean source anchors before the Maiko-protocol tooling update

| Artifact | Identifier |
|---|---|
| Personal repository branch | `agent/irp-optimisation-closure` |
| Personal repository commit | `58b20645cc36deaf89237f8a63246440b1ab5d5a` |
| Supervisor repository branch | `algorithm-lingxin-kong` |
| Supervisor repository commit | `ecf3e0def3ae40f978d56dbd7120e4daa1037e36` |
| Preserved baseline matcher SHA-256 | `0128e6959aec18af54b99ee1c7d9bb52fb1f6e58086e948391ef3aad52eeb400` |
| Progress matcher SHA-256 | `bc4987ca3922c53cee0ef6701242f4c33ea500ff2a57887ccbfe8357eed2f5be` |
| Progress normalisation SHA-256 | `dcea1ff38f98790ad7864d082d34ad0079b4007954702a374faa9bb54657bc23` |

The progress matcher and normalisation files were byte-identical between the
personal snapshot and supervisor branch at this checkpoint.

## Demonstration-only investor fixture

The tracked fictional fixture SHA-256 is
`f3d12b721f880b0f913bd7d60efe9960f3a3791328395563de32e3e343d7969a`.
It is valid only for offline code-path demonstration and automated tests. It
must not be reported as the real final investor population.

## Formal freeze still pending

The following values cannot be truthfully filled until Maiko's data arrives
and the evaluation tooling changes have been committed:

- final clean personal-repository commit;
- final matching/configuration source-set hash;
- two or three real funding-round input hashes;
- authorised investor CSV filename and SHA-256;
- investor candidate ID-set and input-order hashes;
- exact Top-K and semantic mode/model/prompt;
- baseline and optimised output hashes;
- reviewer pack, returned review and evaluation hashes.

The comparison and expert-review commands record these values in protected
`exports/*.local.*` artifacts. A formal run is refused when the Git worktree is
dirty. Do not replace the pending values with the fictional fixture hash or an
unverified platform snapshot.
