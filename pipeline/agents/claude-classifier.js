/**
 * =============================================================================
 * Claude Classifier Agent
 * =============================================================================
 *
 * Phase 2: Context Classification Agent
 * Uses Claude to analyze extracted PDF content and classify relevance to slide types.
 */

const { BaseAgent, AgentError } = require("./base-agent");
const fs = require("fs");
const path = require("path");

// =============================================================================
// Slide Types Definition
// =============================================================================

const SLIDE_TYPES = [
  "title",
  "purpose",
  "problem",
  "solution",
  "whyNow",
  "marketSize",
  "competition",
  "product",
  "businessModel",
  "traction",
  "team",
  "ask",
];

// =============================================================================
// Claude Classifier Agent
// =============================================================================

class ClaudeClassifier extends BaseAgent {
  constructor(config = {}) {
    super(config);
    this.agentType = "classifier";
    this.provider = "anthropic";
    this.model = config.model || "claude-sonnet-4-20250514";
    this.maxTokens = config.maxTokens || 8192;
    this.client = null;
  }

  /**
   * Initialize the Anthropic client
   */
  async initClient() {
    if (this.client) return;

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AgentError(
        "ANTHROPIC_API_KEY environment variable is required.\n" +
          "Set it with: export ANTHROPIC_API_KEY='your-api-key'"
      );
    }

    // Dynamic import for ES module
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.log("info", `Initialized Claude client with model: ${this.model}`);
  }

  /**
   * Main execution method
   */
  async execute(input) {
    const { extractedTextsDir, storyPath, styleGuidePath, outputDir } = input;

    this.log("info", "Starting context classification...");

    // Initialize client unless dry-run mode is active
    if (!this.shouldSkipAPICall()) {
      await this.initClient();
    }

    // Load user inputs
    const story = this.loadText(storyPath);
    const styleGuide = this.loadText(styleGuidePath);

    // Load system prompt
    const systemPromptPath = path.join(
      __dirname,
      "../config/agent-prompts/classifier-system.md"
    );
    const systemPrompt = this.loadText(systemPromptPath);

    // Get list of extracted text files
    const textFiles = fs
      .readdirSync(extractedTextsDir)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => path.join(extractedTextsDir, f));

    this.log("info", `Found ${textFiles.length} documents to classify`);

    // Phase 1: Generate Table of Contents
    this.log("info", "Phase 1: Generating Table of Contents...");
    const tableOfContents = await this.generateTableOfContents(textFiles, outputDir);
    this.saveJSON(path.join(outputDir, "table-of-contents.json"), tableOfContents);
    this.log("info", `TOC generated with ${tableOfContents.documents.length} documents`);

    // Phase 2: Classify each document with TOC context
    this.log("info", "Phase 2: Classifying documents with TOC context...");
    const classifications = [];
    for (const filePath of textFiles) {
      const filename = path.basename(filePath);
      this.log("info", `Classifying: ${filename}`);

      try {
        const content = this.loadText(filePath);

        // Skip empty files
        if (content.trim().length < 100) {
          this.log("warn", `Skipping ${filename}: too short (${content.length} chars)`);
          continue;
        }

        const classification = await this.classifySingleDocument(
          filename,
          content,
          systemPrompt,
          story,
          styleGuide,
          tableOfContents
        );

        classifications.push(classification);
      } catch (error) {
        this.log("error", `Failed to classify ${filename}`, {
          error: error.message,
        });
      }
    }

    // Merge classifications into slide-organized structure
    const result = this.mergeClassifications(classifications, story, styleGuide);

    // Add TOC reference to result
    result.tableOfContents = tableOfContents;

    // Save outputs
    this.saveJSON(path.join(outputDir, "classified-context.json"), result);
    this.saveJSON(
      path.join(outputDir, "relevance-matrix.json"),
      this.buildRelevanceMatrix(classifications)
    );

    this.log("info", "Classification complete");
    this.log("info", `Cost summary: $${this.costTracker.totalCost.toFixed(4)}`);

    return result;
  }

  /**
   * Generate a Table of Contents by analyzing all documents
   * This provides context for the classifier about the full document set
   */
  async generateTableOfContents(textFiles, outputDir) {
    const documents = [];

    // First pass: Extract metadata and preview from each document
    for (const filePath of textFiles) {
      const filename = path.basename(filePath);
      const content = this.loadText(filePath);

      if (content.trim().length < 100) continue;

      // Extract first 2000 chars as preview for TOC analysis
      const preview = content.substring(0, 2000);

      documents.push({
        filename,
        filePath,
        charCount: content.length,
        wordCount: content.split(/\s+/).length,
        preview,
      });
    }

    // Build TOC prompt
    const tocPrompt = this.buildTOCPrompt(documents);

    // Log prompt for debugging
    this.logPromptIfEnabled("toc", tocPrompt);

    // Check for dry-run mode
    if (this.shouldSkipAPICall()) {
      this.logDryRun("generate TOC", this.estimateTokens(tocPrompt));
      return this.generateMockTOC(documents);
    }

    // Call Claude to analyze and categorize documents
    const response = await this.withRetry(async () => {
      const result = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: `You are a document analyst. Analyze the provided document previews and create a structured table of contents that categorizes each document by type and content.

Your output must be valid JSON with this structure:
{
  "documents": [
    {
      "filename": "example.txt",
      "documentType": "pitch_deck|financial_model|market_research|product_docs|team_info|legal|press|other",
      "contentCategory": "Brief category description",
      "keyTopics": ["topic1", "topic2"],
        "estimatedRelevance": {
          "title": 0.0-1.0,
          "purpose": 0.0-1.0,
          "problem": 0.0-1.0,
          "solution": 0.0-1.0,
          "whyNow": 0.0-1.0,
          "marketSize": 0.0-1.0,
          "competition": 0.0-1.0,
          "product": 0.0-1.0,
        "businessModel": 0.0-1.0,
        "traction": 0.0-1.0,
        "team": 0.0-1.0,
        "ask": 0.0-1.0
      },
      "summary": "1-2 sentence summary of document content"
    }
  ],
  "overallCoverage": {
    "strongAreas": ["slides with good coverage"],
    "weakAreas": ["slides that may need more content"],
    "potentialConflicts": ["areas where documents may conflict"]
  },
  "recommendedProcessingOrder": ["filename1.txt", "filename2.txt"]
}`,
        messages: [{ role: "user", content: tocPrompt }],
      });

      // Track costs
      const inputTokens = result.usage?.input_tokens || 0;
      const outputTokens = result.usage?.output_tokens || 0;
      this.costTracker.addUsage(this.provider, this.model, inputTokens, outputTokens);

      return result;
    });

    // Extract JSON from response
    const responseText = response.content[0].text;
    const toc = this.extractJSON(responseText);

    // Add metadata
    toc.generatedAt = new Date().toISOString();
    toc.totalDocuments = documents.length;
    toc.totalWords = documents.reduce((sum, d) => sum + d.wordCount, 0);
    toc.totalChars = documents.reduce((sum, d) => sum + d.charCount, 0);

    return toc;
  }

  /**
   * Build the prompt for TOC generation
   */
  buildTOCPrompt(documents) {
    let prompt = `# Document Set Analysis

Analyze the following ${documents.length} documents and create a table of contents that categorizes each by type and content relevance to investor deck slides.

## Documents

`;

    for (const doc of documents) {
      prompt += `### ${doc.filename}
- **Size:** ${doc.wordCount} words (${doc.charCount} chars)
- **Preview:**
\`\`\`
${doc.preview}
\`\`\`

`;
    }

    prompt += `## Instructions

1. Identify the document type (pitch_deck, financial_model, market_research, product_docs, team_info, legal, press, other)
2. Determine key topics covered
3. Estimate relevance (0.0-1.0) to each investor deck slide type
4. Provide a brief summary
5. Identify overall coverage strengths/weaknesses across the document set
6. Recommend processing order (most comprehensive/reliable documents first)

Return ONLY valid JSON.`;

    return prompt;
  }

  /**
   * Generate mock TOC for dry-run mode
   */
  generateMockTOC(documents) {
    return {
      documents: documents.map((doc) => ({
        filename: doc.filename,
        documentType: "other",
        contentCategory: "[DRY-RUN] Mock category",
        keyTopics: ["[DRY-RUN] mock topic"],
        estimatedRelevance: {
          title: 0.5,
          purpose: 0.5,
          problem: 0.5,
          solution: 0.5,
          whyNow: 0.5,
          marketSize: 0.5,
          competition: 0.5,
          product: 0.5,
          businessModel: 0.5,
          traction: 0.5,
          team: 0.5,
          ask: 0.5,
        },
        summary: `[DRY-RUN] Mock summary for ${doc.filename}`,
      })),
      overallCoverage: {
        strongAreas: ["[DRY-RUN] mock strong area"],
        weakAreas: ["[DRY-RUN] mock weak area"],
        potentialConflicts: [],
      },
      recommendedProcessingOrder: documents.map((d) => d.filename),
      generatedAt: new Date().toISOString(),
      totalDocuments: documents.length,
      totalWords: documents.reduce((sum, d) => sum + d.wordCount, 0),
      totalChars: documents.reduce((sum, d) => sum + d.charCount, 0),
      dryRun: true,
    };
  }

  /**
   * Classify a single document
   */
  async classifySingleDocument(filename, content, systemPrompt, story, styleGuide, tableOfContents = null) {
    // Truncate content if too long (leave room for prompt and response)
    const maxContentLength = 100000; // ~25K tokens
    const truncatedContent = this.truncateText(content, maxContentLength);

    const userPrompt = this.buildUserPrompt(
      filename,
      truncatedContent,
      story,
      styleGuide,
      tableOfContents
    );

    // Log prompts for debugging/auditing
    this.logPromptIfEnabled("system", systemPrompt);
    this.logPromptIfEnabled("user", userPrompt, { documentFilename: filename });

    // Check for dry-run mode
    if (this.shouldSkipAPICall()) {
      this.logDryRun(`classify ${filename}`, this.estimateTokens(userPrompt));
      return this.generateMockClassification(filename);
    }

    const response = await this.withRetry(async () => {
      const result = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Track costs
      const inputTokens = result.usage?.input_tokens || 0;
      const outputTokens = result.usage?.output_tokens || 0;
      this.costTracker.addUsage(this.provider, this.model, inputTokens, outputTokens);

      return result;
    });

    // Extract JSON from response
    const responseText = response.content[0].text;
    const classification = this.extractJSON(responseText);

    // Add filename to classification
    classification.documentAnalysis = classification.documentAnalysis || {};
    classification.documentAnalysis.filename = filename;

    return classification;
  }

  /**
   * Build user prompt for classification
   */
  buildUserPrompt(filename, content, story, styleGuide, tableOfContents = null) {
    // Build TOC context section if available
    let tocContext = "";
    if (tableOfContents && tableOfContents.documents) {
      const thisDoc = tableOfContents.documents.find((d) => d.filename === filename);
      const otherDocs = tableOfContents.documents.filter((d) => d.filename !== filename);

      tocContext = `
## Document Context (Table of Contents)

This document is part of a set of ${tableOfContents.totalDocuments} documents.

**This Document's Profile:**
- Type: ${thisDoc?.documentType || "unknown"}
- Category: ${thisDoc?.contentCategory || "unknown"}
- Key Topics: ${thisDoc?.keyTopics?.join(", ") || "unknown"}
- Summary: ${thisDoc?.summary || "unknown"}

**Other Documents in Set:**
${otherDocs
  .map(
    (d) =>
      `- **${d.filename}** (${d.documentType}): ${d.summary || d.contentCategory}`
  )
  .join("\n")}

**Coverage Analysis:**
- Strong areas: ${tableOfContents.overallCoverage?.strongAreas?.join(", ") || "N/A"}
- Weak areas needing content: ${tableOfContents.overallCoverage?.weakAreas?.join(", ") || "N/A"}
- Potential conflicts to watch: ${tableOfContents.overallCoverage?.potentialConflicts?.join(", ") || "None"}

Use this context to:
1. Focus extraction on content unique to this document
2. Note when this doc may conflict with others
3. Prioritize content for weak coverage areas
4. Cross-reference with related documents when relevant
`;
    }

    return `
## Document to Classify

**Filename:** ${filename}

**Content:**
\`\`\`
${content}
\`\`\`
${tocContext}
## User's Desired Story Arc

${story}

## Style Guide Constraints

${styleGuide}

## Instructions

Analyze this document and return a JSON object with:
1. Document analysis metadata
2. Relevance scores (0-1) for each of the 12 slide types
3. Extracted content for each relevant slide type
4. Any conflicts or missing critical information

Focus on extracting:
- Specific statistics and metrics
- Direct quotes that could be used
- Facts that support the user's desired narrative
- Data points with source attribution

Return ONLY valid JSON wrapped in \`\`\`json code blocks.
`;
  }

  /**
   * Merge individual document classifications into slide-organized structure
   */
  mergeClassifications(classifications, story, styleGuide) {
    const result = {
      metadata: {
        classifiedAt: new Date().toISOString(),
        totalDocuments: classifications.length,
        storyDigest: this.hashString(story).substring(0, 8),
        styleDigest: this.hashString(styleGuide).substring(0, 8),
        costIncurred: this.costTracker.totalCost,
      },
      slides: {},
      globalConflicts: [],
      missingCritical: new Set(),
    };

    // Initialize slide structures
    for (const slideType of SLIDE_TYPES) {
      result.slides[slideType] = {
        relevantSources: [],
        allContent: [],
        conflicts: [],
        dataQuality: {
          completeness: 0,
          sourceCount: 0,
          avgConfidence: 0,
        },
      };
    }

    // Process each classification
    for (const classification of classifications) {
      const filename = classification.documentAnalysis?.filename || "unknown";

      // Process slide relevance
      for (const slideType of SLIDE_TYPES) {
        const slideData = classification.slideRelevance?.[slideType];
        if (!slideData) continue;

        const score = slideData.score || 0;

        // Only include if relevance > 0.3
        if (score > 0.3) {
          result.slides[slideType].relevantSources.push({
            filename,
            relevanceScore: score,
            extractedFacts: (slideData.extractedContent || []).filter(
              (c) => c.type === "fact" || c.type === "statistic"
            ),
            quotes: (slideData.extractedContent || []).filter(
              (c) => c.type === "quote"
            ),
            metrics: (slideData.extractedContent || []).filter(
              (c) => c.type === "metric" || c.type === "statistic"
            ),
            allContent: slideData.extractedContent || [],
          });

          // Add to allContent
          if (slideData.extractedContent) {
            for (const item of slideData.extractedContent) {
              result.slides[slideType].allContent.push({
                ...item,
                source: filename,
              });
            }
          }
        }
      }

      // Collect conflicts
      if (classification.conflicts && classification.conflicts.length > 0) {
        result.globalConflicts.push(...classification.conflicts);
      }
    }

    // Calculate data quality metrics for each slide
    for (const slideType of SLIDE_TYPES) {
      const slide = result.slides[slideType];
      const sources = slide.relevantSources;

      slide.dataQuality.sourceCount = sources.length;
      slide.dataQuality.completeness =
        sources.length > 0
          ? Math.min(1, sources.length / 3) // Consider "complete" if 3+ sources
          : 0;

      if (sources.length > 0) {
        const avgScore =
          sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length;
        slide.dataQuality.avgConfidence = avgScore;
      }

      // Sort sources by relevance
      slide.relevantSources.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Perform aggregate gap analysis - what's ACTUALLY missing across all documents
    result.missingCritical = this.analyzeAggregateGaps(result.slides);

    return result;
  }

  /**
   * Analyze what information is truly missing across all documents
   * This replaces the naive per-document gap collection
   */
  analyzeAggregateGaps(slides) {
    const gaps = [];

    // Define critical requirements for each slide type
    const criticalRequirements = {
      title: ["company_name", "tagline"],
      problem: ["pain_point", "statistic"],
      solution: ["value_proposition", "feature"],
      whyNow: ["timing_factor", "trend"],
      marketSize: ["tam", "sam", "market_size", "market"],
      competition: ["competitor", "differentiation"],
      product: ["feature", "capability"],
      businessModel: ["revenue_model", "pricing", "unit_economics"],
      traction: ["metric", "milestone", "customer"],
      team: ["founder", "executive", "background", "bio"],
      ask: ["funding_amount", "use_of_funds"],
    };

    // Check each slide type for missing content
    for (const [slideType, requirements] of Object.entries(criticalRequirements)) {
      const slide = slides[slideType];
      if (!slide) continue;

      const contentTypes = slide.allContent.map((c) =>
        (c.type || "").toLowerCase()
      );
      const contentText = slide.allContent.map((c) =>
        (c.content || "").toLowerCase()
      ).join(" ");

      // Check if we have any relevant content
      const hasContent = slide.allContent.length > 0;
      const hasHighQualitySource = slide.relevantSources.some(s => s.relevanceScore > 0.7);

      if (!hasContent && !hasHighQualitySource) {
        gaps.push(`${slideType}: No content found`);
      } else if (slide.dataQuality.completeness < 0.3) {
        // Check for specific missing requirements
        for (const req of requirements) {
          const hasReq = contentTypes.some(t => t.includes(req)) ||
                        contentText.includes(req.replace("_", " "));
          if (!hasReq) {
            // Don't report as missing if we have some content
            // Only report if the slide has very little content overall
            if (slide.allContent.length < 2) {
              gaps.push(`${slideType}: Limited ${req.replace("_", " ")} information`);
            }
          }
        }
      }
    }

    // Remove duplicates and limit output
    const uniqueGaps = [...new Set(gaps)];
    return uniqueGaps.slice(0, 10); // Limit to top 10 actual gaps
  }

  /**
   * Build relevance matrix (document x slide type)
   */
  buildRelevanceMatrix(classifications) {
    const matrix = {
      documents: [],
      slideTypes: SLIDE_TYPES,
      scores: [],
    };

    for (const classification of classifications) {
      const filename = classification.documentAnalysis?.filename || "unknown";
      matrix.documents.push(filename);

      const row = {};
      for (const slideType of SLIDE_TYPES) {
        row[slideType] = classification.slideRelevance?.[slideType]?.score || 0;
      }
      matrix.scores.push(row);
    }

    return matrix;
  }

  /**
   * Simple string hash for digest
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate mock classification for dry-run mode
   */
  generateMockClassification(filename) {
    const slideRelevance = {};
    for (const slideType of SLIDE_TYPES) {
      slideRelevance[slideType] = {
        score: 0.5,
        extractedContent: [
          {
            type: "mock",
            content: `[DRY-RUN] Mock content for ${slideType} from ${filename}`,
            confidence: 0.5,
          },
        ],
      };
    }

    return {
      documentAnalysis: {
        filename,
        type: "mock",
        dryRun: true,
        timestamp: new Date().toISOString(),
      },
      slideRelevance,
      conflicts: [],
      missingCritical: [],
    };
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { ClaudeClassifier, SLIDE_TYPES };
