# Repository guidance

## Version control

Use native Git for this repository. Git LFS manages the tutorial PNGs under `src/assets/`.

Do not initialize or run Jujutsu (`jj`) here. It previously rewrote LFS pointers as image blobs.

Preserve `.gitattributes` and the Git LFS filters and hooks. Before committing asset changes, run `git lfs fsck` and review `git diff --cached` to ensure the index contains LFS pointers rather than full image blobs.
