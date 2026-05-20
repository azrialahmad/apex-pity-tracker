# Apex Legends Pity Tracker

A strict **zero-server**, client-side application that accurately calculates your Apex Legends Heirloom Pity Timer (out of 500 packs) by parsing official EA GDPR JSON data exports.

## Features
- **100% Private**: Your EA data is processed entirely in your browser using local JavaScript APIs. No data is ever uploaded or stored.
- **Auto-Detection**: Automatically identifies your previous Mythic/Heirloom purchases and dynamically filters out older packs.
- **Lifetime Tracking**: See exactly how many standard packs you've opened across your account's lifetime.
- **Experimental Event Filtering**: Toggleable option to filter out Collection Event packs and view an exact breakdown of event IDs.

## How to Use
1. Log into your EA account and go to **Account Settings > EA Data Privacy**.
2. Click **Request a Download** and select "Apex Legends".
3. Once you receive the ZIP via email, extract the `Request-[ID]-ApexLegends.json` file.
4. Drop the JSON file into the Tracker app to view your pity timer.

## Technology Stack
- React
- Vite
- Tailwind CSS
- Lucide React

## Local Development
```bash
npm install
npm run dev
```

## Edge Cases Handled
- **Unique Timestamps**: Deduplication of identical timestamps from the same pack (`Set` logic).
- **Auto-Discarding**: Discards older pack opens based on newest Mythic timestamp.
- **Thematic Pool Flaw**: Uses mathematically accurate `packs_open` calculation by default to prevent undercounting, but provides an experimental toggle to manually strip identified Collection Event packs from the total.
- **Cross-Platform Parsing**: Scans all sub-arrays (`data.userData`) for accurate extraction.
