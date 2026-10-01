# Interactive sRGB vs Linear Color Space Experiment

## 1. Goal

Build an interactive Three.js web experiment that helps users understand why:

- Color textures such as Base Color are commonly encoded in sRGB.
- Lighting calculations must operate in a linear working space.
- Incorrect color-space interpretation produces visibly different rendering results.
- Data textures such as Roughness must **not** be treated as sRGB color textures.

The experience should focus on **visual comparison and interaction**, rather than long theoretical explanations.

The experiment begins directly with a 3D scene. Do not include a basic introductory lesson explaining what sRGB is.

---

# Stage 1 — Correct vs Incorrect Rendering

## Objective

Show two visually identical 3D objects under identical lighting conditions.

The only difference between them should be how the Base Color texture is interpreted.

### Layout

Use a split-screen comparison:

```text
-----------------------------------------------------

      WRONG                         CORRECT

 No sRGB decoding              sRGB → Linear

        Sphere                     Sphere
          ◯                           ◯


-----------------------------------------------------

Light Intensity

Dark  ───────────●──────────── Bright

-----------------------------------------------------
```

Both objects must use:

- identical geometry
- identical material parameters
- identical Base Color texture
- identical roughness
- identical metallic value
- identical lighting
- identical environment
- identical camera conditions

The **only intentional difference** is color-space handling.

---

## Left Object — Incorrect Pipeline

Treat the Base Color texture values as if they were already linear.

Conceptually:

```text
Base Color Texture

RGB
 ↓
NO sRGB decoding
 ↓
Values incorrectly interpreted as Linear
 ↓
Lighting calculation
```

Example:

```text
Texture value:

sRGB = 0.5

Incorrect interpretation:

Linear = 0.5
```

Clearly label this object:

**Incorrect — No sRGB Decode**

---

## Right Object — Correct Pipeline

Interpret the Base Color texture as sRGB and decode it before lighting calculations.

Conceptually:

```text
Base Color Texture

sRGB
 ↓
sRGB Decode
 ↓
Linear RGB
 ↓
Lighting calculation
```

Example:

```text
sRGB = 0.5

↓

Linear ≈ 0.214
```

Clearly label this object:

**Correct — sRGB → Linear**

---

## Interaction

Provide a **Light Intensity** slider.

Example range:

```text
0 ───────────────── 5
```

Both objects must receive exactly the same light intensity.

The purpose is to demonstrate that the difference is not caused by different lights.

Users should be able to move the light intensity continuously and observe how incorrect color-space interpretation affects the rendering under different illumination levels.

Optionally provide simple controls for:

- Light direction
- Base Color texture selection
- Neutral gray vs colored texture

Do not add controls unless they help demonstrate color-space behavior.

---

# Stage 2 — Interactive Rendering Pipeline

## Objective

Allow the user to intentionally break the rendering pipeline.

Instead of only showing two results, visualize the transformation from texture data to final display output.

---

## Pipeline Visualization

Display a simplified rendering pipeline next to the 3D object:

```text
Base Color Texture
RGB = 128
      │
      ▼
┌─────────────────┐
│   sRGB Decode   │  ON
└─────────────────┘
      │
      ▼
Linear ≈ 0.214
      │
      ▼
┌─────────────────┐
│    Lighting     │
└─────────────────┘
      │
      ▼
Linear Scene Result
      │
      ▼
┌─────────────────┐
│ Tone / Display  │
│ Transformation  │
└─────────────────┘
      │
      ▼
    Display
```

The pipeline should update dynamically when the user changes settings.

---

## sRGB Decode Toggle

Provide a toggle:

**Decode Base Color from sRGB**

Default:

```text
ON
```

When ON:

```text
sRGB 0.5
   ↓
Decode
   ↓
Linear ≈ 0.214
```

When OFF:

```text
sRGB 0.5
   ↓
No Decode
   ↓
Linear = 0.5
```

The 3D result must update immediately.

---

## Show Numerical Values

This is important.

Do not rely only on visual differences.

Display the actual values moving through the pipeline.

For example:

```text
Texture Value
0.500

↓

Linear Value
0.214

↓

Lighting Result
0.xxx
```

When sRGB decoding is disabled:

```text
Texture Value
0.500

↓

Linear Value
0.500   ← incorrectly interpreted

↓

Lighting Result
0.xxx
```

Use a visual warning when a color texture is incorrectly treated as linear:

```text
⚠ Base Color is being interpreted as linear data.
```

Avoid describing Linear RGB as "what humans cannot see" or sRGB as simply "what humans see."

A more accurate mental model is:

```text
sRGB
= an encoded color representation commonly used for images/display-oriented color data

Linear RGB
= a representation suitable for lighting and physical arithmetic
```

---

# Stage 3 — Roughness Reversal

## Objective

After teaching:

```text
Color Texture
sRGB → Linear
```

introduce an important exception:

**Not every texture contains color.**

This stage should deliberately challenge the assumption that every texture should receive sRGB decoding.

---

## Scene

Use a metallic or semi-metallic sphere where roughness changes are visually obvious.

Show a grayscale Roughness texture.

Example:

```text
Black                       White

0 ───────── 128 ─────────── 255

Smooth                     Rough
```

Explain that these pixel values represent **numbers**, not visible colors.

For example:

```text
128 / 255 ≈ 0.502

Roughness ≈ 0.5
```

---

# Correct Roughness Pipeline

The correct interpretation should be:

```text
Roughness Texture
RGB = 128
      │
      ▼
Read as Data
      │
      ▼
0.502
      │
      ▼
Material Roughness
```

No sRGB decoding should occur.

---

# Incorrect Roughness Pipeline

Allow the user to intentionally enable:

**Treat Roughness as sRGB**

Then show:

```text
Texture Value
0.502
   ↓
sRGB Decode
   ↓
≈ 0.216
   ↓
Material Roughness
```

The sphere should immediately become noticeably smoother because the roughness value has been incorrectly transformed.

Display a warning:

```text
⚠ Roughness is data, not color.

sRGB decoding changed the intended value:

0.502 → ≈ 0.216
```

---

# Side-by-Side Roughness Comparison

Preferably show two objects:

```text
WRONG                           CORRECT

Roughness treated              Roughness treated
as sRGB                        as Linear Data

0.502                          0.502
  ↓
sRGB Decode
  ↓
≈ 0.216                        0.502

    ◯                              ◯
 smoother                       intended
```

Both objects must again use identical:

- geometry
- lighting
- environment
- material
- camera
- roughness texture

Only the interpretation of the roughness texture should differ.

---

# Final Mental Model

End the experiment with a compact summary.

```text
             TEXTURE
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼

   COLOR DATA         NUMERIC DATA

   Base Color         Roughness
   Albedo             Metallic
   Color Maps         AO
       │              Masks
       │                 │
       ▼                 ▼

     sRGB             No sRGB
       │              decoding
       ▼                 │
    Decode               │
       │                 │
       └────────┬────────┘
                ▼
             Linear
                │
                ▼
        Rendering / PBR
                │
                ▼
        Display Pipeline
                │
                ▼
              Screen
```

Key takeaway:

> **Color textures and data textures may look like ordinary images, but they represent fundamentally different information.**

A Base Color texture contains encoded color information.

A Roughness texture contains numerical material parameters.

Therefore:

```text
Base Color
→ interpret according to its color space
→ commonly sRGB → Linear

Roughness / Metallic / AO / Masks
→ treat as numerical data
→ no sRGB decoding
```

---

# Three.js Implementation Notes

Use a recent version of Three.js with its current color-management system.

For a Base Color texture, explicitly identify the texture as sRGB:

```js
baseColorTexture.colorSpace = THREE.SRGBColorSpace;
```

For data textures such as Roughness:

```js
roughnessTexture.colorSpace = THREE.NoColorSpace;
```

The experiment must also include intentionally incorrect versions for educational comparison.

For example:

```js
// Intentionally wrong for demonstration
baseColorTexture.colorSpace = THREE.NoColorSpace;
```

and an intentionally incorrect Roughness configuration that applies an sRGB-like decode before using the value as roughness.

Be careful not to accidentally let other differences between the two materials influence the comparison.

---

# Recommended Rendering Setup

Use:

- `WebGLRenderer`
- `PerspectiveCamera`
- `MeshStandardMaterial` or `MeshPhysicalMaterial`
- Sphere geometry
- Directional or area-like lighting
- Neutral environment
- Neutral background

A sphere is preferred because specular highlights and roughness changes are easier to observe across curved surfaces.

For the Roughness experiment, use a material with enough specular response for the difference between approximately `0.5` and `0.21` roughness to be obvious.

---

# UX Principles

The experience should follow:

**Observe → Manipulate → Break → Understand**

Do not present large paragraphs before the experiment.

Let users interact first.

Whenever possible, connect a visual change to its numerical cause:

```text
Pixel value
     ↓
Color-space interpretation
     ↓
Linear value
     ↓
Rendering calculation
     ↓
Visible result
```

Users should always be able to answer:

1. What value was stored in the texture?
2. How was that value interpreted?
3. What value entered the rendering calculation?
4. Why did the final appearance change?

The main educational message is not simply:

> "sRGB looks different from Linear."

It is:

> **The meaning assigned to texture values determines whether those values are valid inputs for rendering calculations.**
