# Zach's Diner Cyber POS (CMD + NCR Touch GUI)

Diner POS system with:
- **CLI mode** for Windows CMD (green/white hacker style)
- **NCR-style touch GUI mode** (large buttons, touch-first flow)

## Features
- Breakfast/Lunch/Dinner dynamic menus
- Dine-in, takeout, delivery order modes (CLI)
- Cash + modern payments (EMV chip, tap-to-pay/NFC wallet, QR pay simulation)
- Real-time kitchen display queue
- Loyalty points by phone number (CLI)
- Inventory tracking and low-stock visibility
- Promo code support
- Manager console with analytics, refund, comp, menu edits, and end-of-day Z report
- Persistent state in `pos_state.json`

## Run
### CLI mode
```bat
python diner_pos.py
```

### NCR touch GUI mode
```bat
python diner_pos.py --gui
```

## Manager PIN
Default manager PIN: `2468`.

## Notes
- Card/tap/QR processing is simulated for offline/local usage.
- GUI is built with Tkinter and optimized for large touch targets.
