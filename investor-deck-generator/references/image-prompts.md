# AI Image Generation Prompts

Consistent visual style templates for investor deck imagery.

## Style System

Choose ONE style for the entire deck. Mixing styles looks unprofessional.

### Style A: Minimal Vector
```
[subject], flat vector illustration, clean geometric shapes, minimal detail,
soft gradients, [primary color] and [accent color] palette, corporate style,
white or light gray background, modern tech aesthetic, 16:9 aspect ratio
```

Best for: SaaS, fintech, productivity tools

### Style B: 3D Isometric
```
[subject], isometric 3D illustration, soft shadows, rounded corners,
[primary color] tones with [accent] highlights, clay render style,
floating elements, clean white background, professional tech aesthetic,
16:9 aspect ratio
```

Best for: Enterprise software, platforms, infrastructure

### Style C: Data Visualization
```
[subject], abstract data visualization style, flowing connection lines,
glowing nodes and networks, dark [primary color] background,
[accent color] highlights, digital aesthetic, professional corporate,
subtle particle effects, 16:9 aspect ratio
```

Best for: AI/ML, analytics, cybersecurity

### Style D: Photorealistic Concept
```
[subject], professional photography style, shallow depth of field,
studio lighting, clean minimalist setting, [primary color] accent props,
corporate environment, high-end aesthetic, 16:9 aspect ratio
```

Best for: Hardware, manufacturing, physical products

### Style E: Abstract Geometric
```
[subject represented as], abstract geometric composition, bold shapes,
[primary color] and [secondary color] color blocks, negative space,
Bauhaus-inspired, modern corporate art, sophisticated minimal,
16:9 aspect ratio
```

Best for: Design tools, creative platforms, brand-focused companies

## Slide-Specific Prompts

### Problem Slide

**Style A (Vector)**:
```
frustrated business professional at cluttered desk with piles of paper,
flat vector illustration, muted desaturated colors expressing frustration,
red warning symbols, broken gears, tangled processes,
clean geometric shapes, corporate style, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric scene of broken workflow with disconnected blocks,
warning signs, tangled paths between systems, frustrated tiny figures,
soft shadows, muted colors, clay render style, 16:9 aspect ratio
```

**Style C (Data)**:
```
fragmented network with broken connections, error nodes glowing red,
data flow interrupted, chaotic scattered elements,
dark background with warning amber accents, 16:9 aspect ratio
```

### Solution Slide

**Style A (Vector)**:
```
clean organized workflow with smooth flowing arrows,
happy professional at streamlined workstation, checkmarks,
bright optimistic colors, [accent] highlights on key elements,
flat vector illustration, success theme, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric unified platform connecting multiple systems seamlessly,
glowing success indicators, smooth data flow between blocks,
bright [primary color] tones, clay render style, 16:9 aspect ratio
```

**Style C (Data)**:
```
harmonious network with perfect connections, nodes pulsing green,
data flowing smoothly along defined paths, elegant organization,
dark background with [accent] success highlights, 16:9 aspect ratio
```

### Why Now Slide

**Style A (Vector)**:
```
timeline arrow moving forward with milestone markers,
converging trend lines meeting at "now" point,
upward trajectory, momentum indicators, flat vector,
[primary] and [accent] colors, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric timeline with past blocks small, present large, future bright,
technology icons evolving along path, convergence point,
clay render style, forward momentum, 16:9 aspect ratio
```

**Style C (Data)**:
```
multiple trend lines converging at central bright node,
timeline visualization with data points intensifying toward present,
dark background with golden "now" highlight, 16:9 aspect ratio
```

### Market Size Slide

**Style A (Vector)**:
```
concentric circles representing TAM SAM SOM, globe with highlighted regions,
dollar signs at appropriate scale, upward trending bar chart,
flat vector, [primary] blues with [accent] highlights, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric stacked coins growing in size, market segments as territories,
figures representing customer personas, opportunity visualization,
clay render, optimistic colors, 16:9 aspect ratio
```

**Style C (Data)**:
```
glowing globe with market regions highlighted, expanding concentric waves,
numerical data floating, growth trajectory lines,
dark background with golden opportunity highlights, 16:9 aspect ratio
```

### Product Slide

**Style A (Vector)**:
```
stylized product interface with key features highlighted,
clean dashboard mockup, floating UI elements,
flat vector illustration, [primary] interface with [accent] CTAs,
modern SaaS aesthetic, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric product hero shot with features floating around it,
device or interface from angle, connection lines to feature labels,
clay render style, professional tech, 16:9 aspect ratio
```

**Style C (Data)**:
```
central product node with feature connections radiating outward,
data processing visualization, elegant information architecture,
dark background with product glowing in [accent], 16:9 aspect ratio
```

### Team Slide

**Style A (Vector)**:
```
collaborative team scene, professionals working together,
flat vector characters, diverse representation, success indicators,
clean office or workspace setting, [primary] tones, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric team workspace with connected stations,
collaboration visualization, shared goals represented,
clay render figures, warm professional colors, 16:9 aspect ratio
```

**Style C (Data)**:
```
network of connected team nodes, expertise areas highlighted,
synergy lines between members, collaborative energy,
dark background with [accent] connection highlights, 16:9 aspect ratio
```

### Ask Slide

**Style A (Vector)**:
```
growth trajectory chart reaching milestone flags,
investment flowing into expanding company representation,
flat vector, confident upward momentum, [accent] success markers,
professional optimistic, 16:9 aspect ratio
```

**Style B (Isometric)**:
```
isometric funding visualization with investment transforming into growth,
milestone achievements as building blocks, rocket or upward motion,
clay render, forward momentum, bright [accent], 16:9 aspect ratio
```

**Style C (Data)**:
```
investment node creating expanding ripple effect,
growth metrics flowing outward, milestone achievements lighting up,
dark background with golden opportunity glow, 16:9 aspect ratio
```

## Color Palette Integration

Replace `[primary]`, `[secondary]`, `[accent]` with your deck colors:

| Deck Theme | Primary | Accent | Background Tone |
|------------|---------|--------|-----------------|
| Tech Navy | deep navy blue | warm orange | cool whites |
| Innovation Teal | rich teal | slate black | warm whites |
| Energy Orange | burnt orange | dark gray | neutral whites |
| Finance Blue | royal blue | emerald green | cool whites |
| Health Green | forest green | ocean teal | warm whites |

## Generation Tips

1. **Consistency**: Generate all images in one session with same style parameters
2. **Aspect ratio**: Always specify 16:9 for slide compatibility
3. **Simplicity**: Avoid overly complex scenes that distract from text
4. **Color matching**: Include your exact hex colors in prompts if model supports it
5. **Background**: Ensure sufficient contrast for overlaid text
6. **Resolution**: Generate at minimum 1920x1080 for crisp display

## Post-Processing

After generation:
1. Resize to exactly 1920x1080 or 3840x2160
2. Ensure consistent color temperature across images
3. Add subtle vignette if backgrounds vary too much
4. Test legibility with actual slide text overlaid
