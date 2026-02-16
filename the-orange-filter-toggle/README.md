# The Orange Filter

A privacy-first Chrome Extension that filters specific topics (default: "Orange") from your browsing feed using Network blocking, DOM text analysis, and local AI image processing.

## Quick Install (No Coding Required)

1.  **Download:** Get the `the-orange-filter-v1.zip` file from this repository.
2.  **Unpack:** Unzip the file to a folder on your computer.
3.  **Open Chrome:** Navigate to `chrome://extensions` in your browser.
4.  **Developer Mode:** Enable **Developer mode** using the toggle in the top right corner.
5.  **Load Extension:** Click the **Load unpacked** button.
6.  **Select Folder:** Choose the folder where you unzipped the files (it should contain `manifest.json`).

---

## For Developers (Build from source)

If you want to build the extension yourself:

1.  **Build the Project:**

    ```bash
    npm install
    npm run build
    ```

2.  **Load into Chrome:**
    - Open `chrome://extensions`.
    - Click **Load unpacked**.
    - Select the **`dist`** folder inside this project directory.

## How to Test

### Manual Testing

1.  **Basic Filtering:**
    - Go to a website containing the keyword "Orange" (e.g., a news site or Wikipedia).
    - Observe that articles or paragraphs containing the keyword are hidden.
    - Click the extension icon in the toolbar to see the blocked item count.

2.  **AI Image Filtering (Premium/Experimental):**
    - Click the extension icon to open the **Popup**.
    - Toggle **"AI Image Filtering"** ON.
    - Accept the **Privacy Consent** dialog.
    - Reload the page. Images matching the "Orange" face vectors should now be scanned and hidden.

### Automated Testing

Run the included unit and integration tests:

```bash
npm test
```

## Development

- **Watch Mode:** `npm run watch` (Rebuilds on file changes).
- **Linting:** `npm run lint` (Checks code style).
