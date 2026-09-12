# Wheelio

A desktop-Chrome random wheel that creates normalized entries from text, images, or detected faces and selects them with a smooth, fair animation.

## Local Setup

```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e .
cd ../frontend && npm install
```

## Environment Configuration

```bash
export OPENROUTER_API_KEY="..."
export OPENROUTER_MODEL="your-vision-capable-openrouter-model"
export OPENROUTER_FACE_MODEL="your-vision-model-for-face-detection"
```

## Development

Start the backend and frontend in separate terminals:

```bash
cd backend && .venv/bin/uvicorn app.main:app --reload
cd frontend && npm run dev
```

## Production Build

Build the frontend and start FastAPI against the production assets:

```bash
cd frontend && npm run build
cd backend && .venv/bin/uvicorn app.main:app
```

## Manual Acceptance Checklist

### Local Entry Parsing
- [ ] Submit `Alice, Bob, Charlie` → wheel created with 3 entries (no network request)
- [ ] Submit `Alice\nBob\nCharlie` → wheel created with 3 entries
- [ ] Submit `Alice ,alice\nBOB ` → wheel created with 2 entries: `Alice` and `Bob` (case-insensitive dedupe)

### CSV/TSV Handling
- [ ] Submit `Name,ID\nAda,1` → goes to API (looks like multi-column data)
- [ ] Submit tab-separated data → goes to API (contains tabs)

### API Extraction
- [ ] Submit a table request → loading state shown, API called
- [ ] Submit a valid PNG/JPEG image → entries extracted from image
- [ ] Submit an invalid file type (e.g., .txt) → error message shown
- [ ] Submit a file >2 MiB → error message: "Upload a PNG or JPEG image no larger than 2 MB."
- [ ] No images are retained on the server

### Face Detection
- [ ] Submit an image with faces → faces detected, numbered entries added to wheel
- [ ] Face grid appears in wheel panel showing detected face images
- [ ] Wheel segments always show numbers when faces are present
- [ ] Submit an image with no faces → error: "No faces detected. Please upload a different image."
- [ ] Submit an image with >25 faces → only first 25 detected
- [ ] New image replaces previous faces on the wheel

### Configuration Errors
- [ ] Start with missing `OPENROUTER_API_KEY` → clear configuration error reported

### Provider Failures
- [ ] Submit with invalid API key → error message shown, wheel unchanged

### Session Persistence
- [ ] Create a wheel, refresh the page → wheel restores
- [ ] Change stored expiry in DevTools to past, reload → session cleared
- [ ] Session refreshes on relevant interactions (extraction, edits, picks)

### Replacement Confirmation
- [ ] Create a wheel, submit new entries → confirmation dialog appears
- [ ] Click Cancel → old wheel remains unchanged
- [ ] Click Replace → new entries replace old, history cleared

### Reset Confirmation
- [ ] Click Reset → confirmation dialog appears
- [ ] Click Cancel → all session state unchanged
- [ ] Click Confirm → entries, picks, transcript, and local storage cleared

### Wheel Spin
- [ ] Create 3-entry wheel, click Start → spin takes ~4 seconds
- [ ] Result modal appears with winner value
- [ ] Click Close → modal hides, wheel remains
- [ ] Click Spin Again → modal hides, new spin starts (if entries remain)

### Entry Removal
- [ ] With "Remove the picked students from wheel" checked → winner removed after pick
- [ ] With unchecked → winner remains, can be picked again
- [ ] Repeated values appear in history when removal disabled

### Empty State
- [ ] Empty wheel → "Wheel is empty" message, Start button disabled
- [ ] Single entry → Start button disabled (need ≥2 entries)

### Entry Editing
- [ ] Click Edit Entries → textarea appears with current entries
- [ ] Edit entries, click Apply → wheel updates, picks cleared
- [ ] Click Cancel → changes discarded

### Controls During Spin
- [ ] During spin: Submit, file input, Start, Edit, Reset all disabled
- [ ] During extraction: same controls disabled

### No Raw Model Prose
- [ ] All extraction results shown as structured data, never raw model text

## Tech Stack

- **Frontend:** React, TypeScript, Vite, SVG
- **Backend:** Python 3.12, FastAPI, Pydantic v2, LangChain, LangGraph, OpenRouter, Pillow
