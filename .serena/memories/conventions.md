# Conventions

- Public domain language is backend-neutral: `VisualActor`, `VisualTask`, `VisualSnapshot`, `VisualEvent`, ports, reducers, and view-models.
- Components are controlled by props/callbacks; unsupported mutations are absent or hidden by explicit capabilities.
- Browser preference keys use a neutral versioned namespace and storage is injected through `StoragePort`.
- Assets resolve through injected `AssetResolver`; machine-specific absolute paths are forbidden.
- Unknown/additive backend events are ignored safely; allowlists determine every field emitted to the browser.
- Never log or persist cookies, secrets, raw events, prompts, messages, responses, tool arguments/results, local paths, memory data, or conversation content.