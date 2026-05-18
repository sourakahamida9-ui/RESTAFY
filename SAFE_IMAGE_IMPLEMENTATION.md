# SafeImage Implementation Guide

## Overview
The SafeImage component replaces all `<img>` tags in the app to handle image loading failures gracefully with fallbacks, skeletons, and auto-generated avatars.

## Files Created
1. `/src/components/SafeImage.tsx` - Universal image component
2. `/scripts/034-configure-storage-bucket.sql` - Bucket configuration for Supabase Storage
3. Updated `/src/components/ui/ImageUpload.tsx` - Now uses SafeImage with bucket validation

## Usage

### Basic Usage
```jsx
import SafeImage from '@/components/SafeImage';

<SafeImage 
  src={imageUrl}
  alt="Description"
  className="w-32 h-32 rounded-lg object-cover"
  fallbackType="avatar"
  initials="JD"
/>
```

### Fallback Types
- **avatar** (default) - Shows colored box with initials
- **placeholder** - Shows gray box with icon
- **icon** - Shows just icon in gray box

### Props
- `src?: string | null` - Image URL
- `alt: string` - Alt text for accessibility
- `className?: string` - Tailwind classes
- `fallbackType?: 'avatar' | 'placeholder' | 'icon'`
- `initials?: string` - Text for avatar (max 2 chars)
- `color?: string` - Hex color for avatar
- `size?: 'sm' | 'md' | 'lg'` - Size presets

## Restaurant Logos

### Auto-Generated Avatar
When a restaurant has no logo, the component automatically generates a colored avatar with the first letter:

```jsx
<SafeImage 
  src={restaurant.logo_url}
  alt={restaurant.name}
  fallbackType="avatar"
  initials={restaurant.name[0]}
  className="w-24 h-24 rounded-lg"
/>
```

The color is automatically derived from the restaurant name using a deterministic hash function.

## Image Loading Flow
1. **Loading** - Skeleton placeholder (animated gray box)
2. **Success** - Image displayed
3. **Error** - Fallback shown (avatar, placeholder, or icon)

## Bucket Configuration

Run the SQL script `034-configure-storage-bucket.sql` in Supabase to:
1. Create 'restaurants', 'menu-items', 'events' buckets
2. Set buckets to public
3. Configure RLS policies for authenticated uploads and public reads

### Important
- Execute via Supabase SQL Editor dashboard
- NOT via app scripts (which use different authentication)
- Check for existing policies to avoid conflicts

## Migration Checklist

### Step 1: Setup Storage
- [ ] Run SQL script 034 in Supabase dashboard
- [ ] Verify buckets are public in Storage settings

### Step 2: Update Components
Replace all `<img>` tags with `<SafeImage>`:

#### Home.tsx - Restaurant Cards
```jsx
// Before
<img src={restaurant.logo_url} alt={restaurant.name} />

// After
<SafeImage 
  src={restaurant.logo_url}
  alt={restaurant.name}
  fallbackType="avatar"
  initials={restaurant.name[0]}
  className="w-12 h-12 rounded-lg"
/>
```

#### RestaurantDetail.tsx - Banner & Menu Items
```jsx
// Banner
<SafeImage 
  src={restaurant.banner_url}
  alt="Banner"
  className="w-full h-40 object-cover"
  fallbackType="placeholder"
/>

// Menu items
<SafeImage 
  src={item.image_url}
  alt={item.name}
  className="w-24 h-24 object-cover rounded-lg"
  fallbackType="placeholder"
/>
```

#### MenuManagement.tsx - Item Editing
```jsx
<SafeImage 
  src={item.image_url}
  alt={item.name}
  className="w-20 h-20 rounded-lg object-cover"
  fallbackType="placeholder"
/>
```

#### RestaurantSettings.tsx - Logo Upload
```jsx
<SafeImage 
  src={restaurant.logo_url}
  alt="Logo"
  className="w-32 h-32 rounded-lg object-cover"
  fallbackType="avatar"
  initials={restaurant.name[0]}
/>
```

#### EventMarketplace & EventDetail.tsx
```jsx
<SafeImage 
  src={event.image_url}
  alt={event.title}
  className="w-full h-40 object-cover rounded-lg"
  fallbackType="placeholder"
/>
```

### Step 3: Test
- [ ] Upload images via ImageUpload component
- [ ] Verify images appear in all pages
- [ ] Test fallbacks by using invalid URLs
- [ ] Check mobile responsiveness

## Common Issues & Solutions

### Images still not showing
- **Cause**: Bucket not public
- **Fix**: Run SQL script 034 in Supabase dashboard

### Upload fails with "Bucket not found"
- **Cause**: Bucket doesn't exist
- **Fix**: Create bucket in Supabase Storage UI and re-run SQL script

### Avatar colors not diverse
- **Cause**: Using same initials for multiple items
- **Fix**: Pass explicit `color` prop with hex codes

### Images load slowly
- **Cause**: No lazy loading
- **Fix**: SafeImage uses `loading="lazy"` by default

## Performance Considerations
- Images use `lazy` loading attribute
- Skeletons are lightweight (just CSS)
- Avatar generation is instant (pure CSS)
- No external dependencies required
