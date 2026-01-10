# How to Bulk Import Parts

You can add many parts at once using the **Import** feature on the Inventory page.

## Detailed Steps

1.  **Open Inventory**: Go to the Inventory page.
2.  **Click Import**: Click the **Upload Icon** <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> (next to the Map Pin icon).
3.  **Prepare Your Data**:
    *   You can write your list in Excel or a text editor.
    *   The format must be strictly: `Part Name, Category, Location, Quantity, Selling Price`
    *   Separate each item with a **comma**.

## Example Data

Copy and paste this into the text box to test:

```csv
Washing Motor X1, Washing Machine Parts, Shelf A, 5, 45.00
Control Board V2, Refrigerator Parts, Warehouse 1, 2, 120.50
Heating Element, Oven Parts, Shelf B, 10, 15.00
Drain Pump, Dishwasher Parts, Shelf A, 4, 32.00
Universal Remote, TV Parts, Front Desk, 20, 12.99
```

## Tips
*   **Locations**: Make sure the location names (like "Shelf A") make sense to you. The system will save them as text.
*   **Categories**: If a category doesn't exist, it will be saved as text for that part, but won't automatically create a "Category" entry in the filter list unless you add it there too. Ideally, use existing categories.
*   **Header**: You can include a header line like `Name, Category, Location...` or leave it out. The system tries to detect it.
