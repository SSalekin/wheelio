# Wheelio MVP Design

**Status:** Approved design; ready for specification review.

## Goal

Build a desktop-Chrome MVP that lets a user create a random-selection wheel from typed or pasted entries, tabular text, or one PNG/JPEG image, then spin it to select entries fairly.

## Scope

- Support individual and classroom users through one desktop-browser experience.
- Keep one active, unnamed wheel per browser session.
- Persist the active wheel, selected history, transcript, and removal preference in local storage for 30 minutes of inactivity. Relevant user actions renew the timer; page load clears expired state.
- Accept direct text, including newline-separated, comma-separated, and TSV/CSV input. Treat the first row as headers for CSV/TSV and the first value as an entry for simple lists.
- Deduplicate entries case-insensitively after trimming whitespace. Display normalized values: title case for names, and preserve casing for IDs and emails.
- Accept one PNG or JPEG image, no larger than 2 MB, optionally with an accompanying instruction such as "pick student IDs." Discard the upload after request processing.
- Create a wheel directly after successful extraction. Replacing a non-empty wheel requires confirmation; the user can cancel or replace it.
- Use a four-second SVG spin with exactly uniform selection probability, automatic accessible colors, no sound or celebration effects, and hidden segment labels when crowded.
- Keep chosen values in selection order. The remove-on-pick setting defaults to checked; when unchecked, repeated selections remain in the history. There is no undo or independent history clear.
- Provide a confirmation-protected reset that clears the wheel and history. Disable spinning for an empty wheel.

## Out of Scope

- Accounts, database persistence, server-side sessions, rate limiting, multi-wheel storage, multi-image or avatar wheels, mobile support, accessibility requirements beyond the MVP, non-Chrome browser support, custom colors, timestamps, spin undo, and automated tests.

## Architecture

The application is a React/TypeScript frontend built with Vite and a Python/FastAPI backend. Production serves both from the same origin. The browser owns all session state in `localStorage`; FastAPI is stateless and does not retain uploaded content or application data.

The frontend handles unambiguous simple pasted lists locally to avoid model calls. Tables, natural-language column requests, ambiguous text, and image submissions are sent as multipart form data to FastAPI. The backend validates uploads before any provider call, then uses LangChain and LangGraph with an OpenRouter model configured by environment variables. OpenRouter is the sole provider for MVP extraction.

## UI Components

- `ChatPanel`: local chat transcript, multiline prompt, one-image chooser, submit state, and error/clarification messages.
- `WheelPanel`: SVG wheel, Start control, remove-on-pick toggle, direct entry editor, history, and reset control.
- `ResultModal`: selected value, Close action, and Spin Again action.
- `sessionStore`: state normalization, expiry enforcement, persistence, restoration, and reset.

## Extraction Contract

FastAPI exposes one synchronous extraction endpoint accepting prompt text and an optional image as multipart form data. It returns a strict JSON union:

- success: a normalized, deduplicated entry list plus optional source-column metadata;
- clarification: a concise request for a user to choose or restate a missing/unknown column; or
- error: a concise safe error message.

The model never supplies a free-form UI answer. When no column is specified, extraction chooses an identifiable name column; if none is reliable, it asks the user to choose from detected headers. If the requested header is missing, it lists available headers. Failed or uncertain extraction leaves the current wheel unchanged.

## Provider and Failure Behavior

The OpenRouter API key and model identifier live only in the FastAPI environment. Missing configuration returns a clear configuration error. Provider requests time out after 60 seconds and have no retry. The frontend displays provider, validation, and extraction errors in the transcript; while a request is pending it disables submit and spinning. During spin it disables entry edits, upload, submit, and reset controls.

## Verification

Use a manual acceptance checklist rather than automated tests. Verify simple local lists; CSV/TSV with headers; natural-language column selection; valid and invalid image submissions; expiry and refresh restoration; replacement and reset confirmation; uniform wheel behavior; remove and retain selections; repeat history; empty-wheel state; and all stated error/loading behavior.
