# Content Mapping Guide

How to extract information from source documents and map to Sequoia slide structure.

## Document Analysis Process

### Step 1: Inventory Source Materials

```bash
# List all documents
ls -la *.pdf *.docx *.pptx *.md 2>/dev/null

# Extract text from each
for f in *.pdf; do
  echo "=== $f ===" >> content-inventory.txt
  python -m markitdown "$f" >> content-inventory.txt 2>/dev/null
done
```

### Step 2: Keyword Search by Slide

Search extracted content for keywords relevant to each slide:

| Slide | Search Keywords |
|-------|-----------------|
| Purpose | mission, vision, "we are", "our company", purpose, "what we do" |
| Problem | problem, pain, challenge, struggle, "customers need", frustration, inefficiency |
| Solution | solution, platform, product, "how we", approach, technology, "our system" |
| Why Now | trend, shift, regulation, technology advancement, timing, emerging, growth |
| Market | market size, TAM, SAM, SOM, billion, million, addressable, opportunity |
| Competition | competitor, alternative, landscape, versus, compared to, differentiation |
| Product | feature, capability, screenshot, interface, architecture, how it works |
| Business Model | revenue, pricing, subscription, margin, unit economics, monetization |
| Traction | customer, user, growth, metric, milestone, partnership, pilot |
| Team | founder, CEO, CTO, experience, background, previously, advisor |
| Ask | raise, funding, investment, use of funds, Series, milestone, runway |

### Step 3: Content Quality Assessment

For each slide, assess:

1. **Data availability**: Do we have specific numbers, names, dates?
2. **Source authority**: Is this from official company docs or third-party?
3. **Recency**: Is this data current or potentially outdated?
4. **Completeness**: Do we have all required elements?

## Slide-by-Slide Extraction

### Title Slide
**Required**: Company name, tagline
**Optional**: Funding round, date, logo

**Search patterns**:
```
company name|incorporated as|doing business as
tagline|slogan|"we are"|mission statement
```

### Company Purpose
**Required**: One declarative sentence
**Ideal length**: 10-15 words

**Extraction approach**:
1. Look for mission/vision statements
2. Check "About Us" sections
3. Find elevator pitch language
4. Distill to single, powerful sentence

**Good examples**:
- "We enable manufacturers to produce parts 10x faster with AI-driven optimization"
- "We make enterprise AI accessible to every business"

**Bad examples** (too vague):
- "We're building the future of technology"
- "We help businesses succeed"

### Problem Slide
**Required**: 3 clear pain points
**Optional**: Supporting statistic, customer quote

**Search patterns**:
```
problem|challenge|pain point|struggle
inefficient|expensive|slow|difficult
customers face|users struggle|companies need
current solutions|status quo|legacy
```

**Structure each point**:
- WHO experiences this problem
- WHAT is the specific pain
- WHY current solutions fail

### Solution Slide
**Required**: Value proposition, 3 key benefits
**Optional**: Product visual, use case

**Search patterns**:
```
solution|platform|approach|technology
enables|provides|delivers|automates
benefit|advantage|value|outcome
unique|proprietary|novel|breakthrough
```

**Value proposition formula**:
"We [verb] [target customer] to [achieve outcome] by [unique mechanism]"

### Why Now Slide
**Required**: 3 market/technology trends
**Optional**: Timeline visualization

**Search patterns**:
```
trend|shift|emerging|growing
AI|cloud|mobile|regulation|pandemic
previously impossible|now possible
market timing|inflection point
```

**Categories to cover**:
1. Technology enablers (what's newly possible)
2. Market shifts (behavior changes)
3. Regulatory/economic factors

### Market Size Slide
**Required**: TAM, SAM, SOM figures
**Optional**: Growth rate, methodology note

**Search patterns**:
```
market size|TAM|SAM|SOM|addressable
billion|million|opportunity|potential
CAGR|growth rate|projected|forecast
segment|vertical|industry
```

**Data quality hierarchy**:
1. Primary research/company analysis (best)
2. Industry reports (Gartner, McKinsey, etc.)
3. Public company filings
4. Press releases/news (verify carefully)

### Competition Slide
**Required**: 3-5 competitors, differentiation
**Optional**: 2x2 matrix positioning

**Search patterns**:
```
competitor|alternative|versus|compared
landscape|market players|incumbents
differentiation|advantage|unique
switching cost|barrier|moat
```

**2x2 matrix axes suggestions**:
- Technology sophistication vs. Ease of use
- Vertical focus vs. Horizontal platform
- Price vs. Capability
- Speed vs. Accuracy

### Product Slide
**Required**: Core features (3-4), visual
**Optional**: Architecture diagram, customer quote

**Search patterns**:
```
feature|capability|functionality
interface|dashboard|platform
API|integration|workflow
screenshot|demo|architecture
```

**Feature description formula**:
"[Feature name]: [What it does] so that [outcome/benefit]"

### Business Model Slide
**Required**: Revenue model, pricing structure
**Optional**: Unit economics, path to profitability

**Search patterns**:
```
revenue model|monetization|pricing
subscription|SaaS|license|transaction
margin|CAC|LTV|unit economics
average contract value|ACV|ARR|MRR
```

**Key metrics to extract**:
- Average contract value (ACV)
- Customer acquisition cost (CAC)
- Lifetime value (LTV)
- Gross margin
- Net revenue retention (NRR)

### Traction Slide
**Required**: 2-3 key metrics with values
**Optional**: Growth chart, customer logos, milestones

**Search patterns**:
```
customer|user|revenue|growth
MRR|ARR|bookings|pipeline
pilot|partnership|deal|contract
milestone|achievement|launch
metric|KPI|performance
```

**Metric presentation rules**:
- Use absolute numbers when impressive
- Use growth rates when trajectory matters
- Include timeframe for context
- Compare to benchmarks if favorable

### Team Slide
**Required**: Founder names, titles, key credentials
**Optional**: Photos, advisors, investors

**Search patterns**:
```
founder|CEO|CTO|COO|team
previously|former|background|experience
advisor|investor|board member
university|degree|credential
```

**Credential priorities**:
1. Directly relevant industry experience
2. Previous startup success
3. Technical expertise for the problem
4. Notable company experience
5. Educational credentials

### Ask Slide
**Required**: Funding amount, use of funds
**Optional**: Milestones, timeline, terms

**Search patterns**:
```
raise|raising|funding|investment|round
Series|seed|pre-seed|bridge
use of funds|allocation|spending
milestone|achieve|target|goal
runway|burn rate|timeline
```

**Use of funds categories**:
- Engineering/Product (typically 40-60%)
- Sales & Marketing (typically 20-30%)
- Operations/G&A (typically 10-20%)
- Hiring/Team (often embedded in above)

## Missing Information Protocol

When content is missing for a slide:

1. **Critical fields**: Flag for user input
2. **Optional fields**: Omit or use placeholder
3. **Derivable data**: Calculate from available info
4. **Industry benchmarks**: Use with "[Industry average]" label

**User input template**:
```
Missing information for [Slide Name]:
- [ ] [Field 1]: [Description of what's needed]
- [ ] [Field 2]: [Description of what's needed]

Can you provide this information, or should I proceed without it?
```

## Quality Checklist

Before generating deck, verify:

- [ ] Company name and tagline confirmed
- [ ] All numbers have sources/methodology
- [ ] No conflicting data across slides
- [ ] Competitor list is current
- [ ] Team credentials are accurate
- [ ] Funding ask aligns with milestones
- [ ] All required fields have content
