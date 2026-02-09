# Color Blindness Accessibility Feature

## Overview
This feature adds comprehensive color blindness support to the ASTBA application, allowing users to select from different vision modes to ensure the application is accessible to users with various types of color vision deficiencies.

## Features Implemented

### 1. **ColorBlindnessContext** (`src/context/ColorBlindnessContext.jsx`)
- Global state management for color blindness mode
- Persists user preference in localStorage
- Applies CSS filters to the entire application
- Supports 5 different vision modes:
  - **Normal Vision** - Default view
  - **Protanopia** (Red-Blind) - Difficulty distinguishing red colors
  - **Deuteranopia** (Green-Blind) - Difficulty distinguishing green colors
  - **Tritanopia** (Blue-Blind) - Difficulty distinguishing blue colors
  - **Achromatopsia** (Total Color Blindness) - Complete inability to see colors

### 2. **ColorBlindnessSelector Component** (`src/components/ColorBlindnessSelector.jsx`)
- Beautiful dropdown interface with glasses/accessibility icon
- Shows current selected mode
- Displays all available vision modes with:
  - Emoji icons for visual identification
  - Mode name and description
  - Active state indicator
- Includes SVG filters for accurate color blindness simulation
- Auto-saves user preference
- Smooth animations and transitions
- Click-outside-to-close functionality

### 3. **Integration Points**

#### App.jsx
- Wrapped entire app with `ColorBlindnessProvider`
- Ensures color blindness mode is available throughout the application

#### Sidebar.jsx
- Added ColorBlindnessSelector in the sidebar footer
- Available to all authenticated users
- Positioned above the logout button

#### Login.jsx
- Added ColorBlindnessSelector on login page
- Allows users to set their preference before logging in
- Ensures accessibility from the first interaction

## How It Works

### Color Transformation
The feature uses two methods for color transformation:

1. **SVG Color Matrix Filters** (for Protanopia, Deuteranopia, Tritanopia)
   - Uses scientifically accurate color transformation matrices
   - Simulates how colors appear to people with specific color vision deficiencies
   - Applied via CSS `filter: url(#filterId)`

2. **CSS Grayscale Filter** (for Achromatopsia)
   - Converts all colors to grayscale
   - Applied via CSS `filter: grayscale(100%)`

### State Management
```javascript
// Context provides:
- colorBlindnessMode: Current active mode ('normal', 'protanopia', etc.)
- setColorBlindnessMode: Function to change the mode
- currentType: Object with mode details (name, description, filter, icon)
```

### Persistence
- User preference is saved to `localStorage` with key `colorBlindnessMode`
- Automatically loaded on app startup
- Persists across sessions and page refreshes

## Usage

### For Users
1. **On Login Page:**
   - Click the glasses/accessibility icon above the footer
   - Select your preferred vision mode
   - The entire page will update immediately

2. **While Logged In:**
   - Find the ColorBlindnessSelector in the sidebar footer
   - Click to open the dropdown
   - Select your preferred mode
   - Your choice is saved automatically

### For Developers

#### Using the Context
```javascript
import { useColorBlindness } from '../context/ColorBlindnessContext';

function MyComponent() {
  const { colorBlindnessMode, setColorBlindnessMode, currentType } = useColorBlindness();
  
  return (
    <div>
      <p>Current mode: {currentType.name}</p>
      <button onClick={() => setColorBlindnessMode('protanopia')}>
        Switch to Protanopia
      </button>
    </div>
  );
}
```

#### Adding the Selector to New Pages
```javascript
import ColorBlindnessSelector from '../components/ColorBlindnessSelector';

function MyPage() {
  return (
    <div>
      {/* Your page content */}
      <ColorBlindnessSelector />
    </div>
  );
}
```

## Technical Details

### Color Transformation Matrices

**Protanopia (Red-Blind):**
```
0.567, 0.433, 0,     0, 0
0.558, 0.442, 0,     0, 0
0,     0.242, 0.758, 0, 0
0,     0,     0,     1, 0
```

**Deuteranopia (Green-Blind):**
```
0.625, 0.375, 0,   0, 0
0.7,   0.3,   0,   0, 0
0,     0.3,   0.7, 0, 0
0,     0,     0,   1, 0
```

**Tritanopia (Blue-Blind):**
```
0.95, 0.05,  0,     0, 0
0,    0.433, 0.567, 0, 0
0,    0.475, 0.525, 0, 0
0,    0,     0,     1, 0
```

### Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- SVG filters are widely supported
- Graceful fallback to normal vision if filters fail

## Benefits

1. **Accessibility Compliance**
   - Meets WCAG accessibility guidelines
   - Inclusive design for users with color vision deficiencies
   - Demonstrates commitment to accessibility

2. **User Experience**
   - Easy to use interface
   - Instant visual feedback
   - Persistent preferences
   - No page reload required

3. **Flexibility**
   - Works with any color scheme
   - Doesn't require code changes to existing components
   - Can be easily extended with more vision modes

## Future Enhancements

Potential improvements:
- Add intensity slider for partial color blindness
- Include color contrast checker
- Add keyboard shortcuts for quick mode switching
- Provide preview mode to test different filters
- Add educational information about each type
- Include statistics about color blindness prevalence

## Testing

To test the feature:
1. Navigate to the login page or any authenticated page
2. Click the ColorBlindnessSelector icon
3. Try each vision mode and observe color changes
4. Refresh the page - your selection should persist
5. Try on different pages to ensure consistency

## Accessibility Notes

- The selector itself is keyboard accessible
- Uses semantic HTML and ARIA labels
- High contrast mode compatible
- Screen reader friendly
- Touch-friendly on mobile devices
