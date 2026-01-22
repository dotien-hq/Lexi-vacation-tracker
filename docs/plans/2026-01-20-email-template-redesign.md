# Email Template Redesign

## Overview

Redesign all 6 email templates to create a premium, polished experience that reflects the Lexi brand identity. The design should feel warm and friendly while maintaining sophistication through abstract decorative patterns and a cohesive blue gradient color palette.

## Design Decisions

| Aspect                | Choice                                                          |
| --------------------- | --------------------------------------------------------------- |
| Polish Level          | Premium/Polished                                                |
| Mood                  | Warm & Friendly                                                 |
| Visual Elements       | Decorative patterns (abstract shapes, gradients, geometric)     |
| Color Palette         | Blue gradient family (Lexi blue + sky blues + soft navy)        |
| Footer Style          | Minimal (brand name + subtle divider)                           |
| Email Differentiation | Contextual accents (status-specific colors on same base layout) |

## Color Palette

### Primary Colors

- **Lexi Blue**: `#0041F0` - Primary brand color, CTAs
- **Sky Blue**: `#3B82F6` - Gradient endpoints
- **Light Sky**: `#60A5FA` - Header gradient right side

### Neutral Colors

- **Slate 900**: `#0F172A` - Main headings
- **Slate 800**: `#1E293B` - Emphasized values
- **Slate 600**: `#475569` - Body text
- **Slate 500**: `#64748B` - Labels, secondary text
- **Slate 400**: `#94A3B8` - Footer text
- **Slate 100**: `#F1F5F9` - Subtle borders
- **Off-white**: `#F8FAFC` - Outer background

### Contextual Accents

- **Success Green**: `#10B981` - Approval accents
- **Success Background**: `#F0FDF4` - Approval card background
- **Coral**: `#F87171` - Denial accents
- **Coral Background**: `#FEF2F2` - Denial card background
- **Blue Background**: `#F0F7FF` - Standard card background

## Structure

### Overall Container

```
+------------------------------------------+
|          (Soft gray background)          |
|  +------------------------------------+  |
|  |         GRADIENT HEADER            |  |
|  |     [Abstract decorations]         |  |
|  |          LEXI                      |  |
|  |     Vacation Tracker               |  |
|  +------------------------------------+  |
|  |                                    |  |
|  |         WHITE CONTENT              |  |
|  |           AREA                     |  |
|  |                                    |  |
|  |  +------------------------------+  |  |
|  |  |     DATA CARD (accented)     |  |  |
|  |  +------------------------------+  |  |
|  |                                    |  |
|  |       [ CTA BUTTON ]               |  |
|  |                                    |  |
|  +------------------------------------+  |
|  |         ── FOOTER ──               |  |
|  |    Lexi Vacation Tracker           |  |
|  +------------------------------------+  |
|  |      [Thin gradient bar]           |  |
+------------------------------------------+
```

### Dimensions & Spacing

- **Container max-width**: 600px
- **Border radius**: 8px
- **Header height**: ~80px
- **Content padding**: 40px horizontal, 32px vertical
- **Card padding**: 20px
- **Button padding**: 16px vertical, 32px horizontal
- **Footer top margin**: 32px
- **Bottom gradient bar**: 4px height

## Component Details

### Header

- Full-width gradient: `#0041F0` (left) to `#60A5FA` (right)
- "LEXI" wordmark: white, bold, letter-spacing: -0.025em
- "Vacation Tracker" subtitle: white, opacity 0.9, smaller size
- Abstract decorations: CSS-generated circles/waves at ~10% opacity

### Typography

| Element           | Size | Weight | Color     |
| ----------------- | ---- | ------ | --------- |
| Main heading (H2) | 24px | 600    | Slate 900 |
| Body text         | 16px | 400    | Slate 600 |
| Emphasized names  | 16px | 600    | Slate 800 |
| Labels            | 14px | 500    | Slate 500 |
| Values            | 14px | 600    | Slate 800 |
| Secondary/Helper  | 14px | 400    | Slate 500 |
| Footer            | 14px | 400    | Slate 400 |

### Data Cards

- Background: contextual (blue/green/coral tint)
- Left border: 4px solid, contextual color
- Border radius: 6px
- Clean label/value pairs with 12px vertical spacing

### CTA Button

- Gradient background: `#0041F0` to `#3B82F6`
- Text: white, 16px, semi-bold
- Padding: 16px 32px
- Border radius: 8px
- Box shadow: `0 2px 4px rgba(0, 65, 240, 0.2)`
- Fallback plain link below button

### Footer

- Thin gradient divider line (blue to transparent)
- Centered "Lexi Vacation Tracker" text
- Bottom gradient bar (4px) as visual bookend

## Email Type Specifications

### 1. Invitation Email (sendInvitationEmail)

- **Header**: Standard blue gradient
- **Accent**: Lexi blue
- **CTA**: "Access Your Account"
- **Tone**: Welcoming

### 2. Token Invitation Email (sendInvitationEmailWithToken)

- **Header**: Standard blue gradient
- **Accent**: Lexi blue
- **CTA**: "Accept Invitation"
- **Note**: Expiry warning in secondary text
- **Tone**: Welcoming, action-oriented

### 3. Re-invite Email (sendReinviteEmail)

- **Header**: Standard blue gradient
- **Accent**: Lexi blue
- **CTA**: "Complete Setup"
- **Note**: "This is a reminder" context
- **Tone**: Friendly reminder

### 4. Request Notification (sendRequestNotificationEmail)

- **Header**: Standard blue gradient
- **Accent**: Lexi blue
- **Card**: Shows requester name, dates, days count
- **CTA**: "Review Request"
- **Tone**: Informative, professional

### 5. Approval Email (sendApprovalEmail)

- **Header**: Blue gradient with subtle green warmth on right
- **Accent**: Success green (#10B981)
- **Card**: Green-tinted background, green left border
- **Celebration**: "Enjoy your time off!" in green
- **CTA**: None (informational)
- **Tone**: Celebratory but professional

### 6. Denial Email (sendDenialEmail)

- **Header**: Standard blue gradient (not red - stays professional)
- **Accent**: Soft coral (#F87171)
- **Card**: Coral-tinted background, coral left border
- **Reason**: Clearly displayed but not harsh
- **CTA**: None (informational)
- **Tone**: Supportive, professional

## Implementation Notes

### Email Client Compatibility

- Use inline styles exclusively (no external CSS)
- Use table-based layout for maximum compatibility
- Provide plain text alternatives
- Test in: Gmail, Outlook, Apple Mail, mobile clients

### Gradient Fallbacks

- CSS gradients may not render in all clients
- Use solid Lexi blue (#0041F0) as fallback background-color
- Progressive enhancement approach

### Abstract Decorations

- Create using positioned divs with border-radius
- Low opacity (10-15%) so they don't interfere with readability
- Fallback: solid color header works without decorations

### Template Architecture

Consider refactoring to:

1. Shared base template function with common header/footer
2. Content-specific sections passed as parameters
3. Contextual theme configuration (colors based on email type)

## Files to Modify

- `lib/email.ts` - All 6 email template functions

## Testing

- Visual testing in email preview tools (Litmus, Email on Acid, or manual)
- Verify plain text versions remain readable
- Test on mobile viewport
- Verify all links work correctly
