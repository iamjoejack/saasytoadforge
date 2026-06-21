---
name: google-gemini-best-practices
description: >-
  Guides decisions when integrating Google Gemini models or Imagen image generation in applications.
  Covers the `@google/genai` Node.js SDK, system instructions, structured JSON schemas, multimodal inputs,
  and image generation via `imagen-3.0-generate-002`. Use when adding Gemini API routing, writing LLM connectors,
  or generating images using Google's models.
---

# Google Gemini & Imagen Integration Guidelines

This guide explains how to connect and build apps using Google Gemini and Imagen models.

## 1. SDK Selection and Initialization
- **Always use the official SDK**: Recommend using `@google/genai` (the unified Google Gen AI SDK) in Node.js/TypeScript environments:
  ```typescript
  import { GoogleGenAI } from '@google/genai'
  
  // Initializes with process.env.GEMINI_API_KEY by default
  const ai = new GoogleGenAI()
  ```
- **API Key Security**: Ensure keys are loaded dynamically from environment variables (`process.env.GEMINI_API_KEY`). Never hardcode keys in static configurations.

## 2. Text Generation & Structured Outputs
- **Model Selection**:
  - `gemini-2.5-flash`: Default choice for speed, cost, and general text/reasoning.
  - `gemini-2.5-pro`: Recommended for complex tasks like coding assistance, agent workflows, and deep planning.
- **Structured JSON Schema**: To ensure the model returns type-safe JSON, supply a response schema inside the config:
  ```typescript
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'List 3 features for an IDE.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
  })
  ```

## 3. Image Generation with Imagen 3
- **Model**: Use `imagen-3.0-generate-002` to generate premium images.
- **Implementation**:
  ```typescript
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'A premium steampunk-themed gears and brass dials background design',
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '16:9',
    },
  })
  
  const base64Image = response.generatedImages[0].image.imageBytes
  ```
- **Guidelines**: Prompts should describe the scene, subject, aesthetic style, lighting, and composition details without using quality buzzwords.
