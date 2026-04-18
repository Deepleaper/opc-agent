import type { MCPTool, MCPToolResult } from '../mcp';
import { VisionManager } from '../../core/vision';
import type { ImageInput } from '../../core/vision';

const manager = new VisionManager();

export const visionAnalyzeTool: MCPTool = {
  name: 'vision_analyze',
  description: 'Analyze an image using vision AI. Provide image as URL or base64.',
  inputSchema: {
    type: 'object',
    properties: {
      image_url: { type: 'string', description: 'URL of the image to analyze' },
      image_base64: { type: 'string', description: 'Base64-encoded image data' },
      prompt: { type: 'string', description: 'Optional prompt for analysis' },
    },
  },
  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const imgInput: ImageInput = input.image_url
      ? { type: 'url', data: input.image_url as string }
      : { type: 'base64', data: input.image_base64 as string };
    const result = await manager.analyze(imgInput, input.prompt as string | undefined);
    return { content: JSON.stringify(result) };
  },
};

export const visionExtractTextTool: MCPTool = {
  name: 'vision_extract_text',
  description: 'Extract text (OCR) from an image.',
  inputSchema: {
    type: 'object',
    properties: {
      image_url: { type: 'string', description: 'URL of the image' },
      image_base64: { type: 'string', description: 'Base64-encoded image data' },
    },
  },
  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const imgInput: ImageInput = input.image_url
      ? { type: 'url', data: input.image_url as string }
      : { type: 'base64', data: input.image_base64 as string };
    const text = await manager.extractText(imgInput);
    return { content: text };
  },
};

export const visionCompareTool: MCPTool = {
  name: 'vision_compare',
  description: 'Compare multiple images.',
  inputSchema: {
    type: 'object',
    properties: {
      image_urls: { type: 'array', items: { type: 'string' }, description: 'URLs of images to compare' },
      prompt: { type: 'string', description: 'Optional comparison prompt' },
    },
  },
  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const urls = input.image_urls as string[];
    const images: ImageInput[] = urls.map(url => ({ type: 'url' as const, data: url }));
    const result = await manager.compareImages(images, input.prompt as string | undefined);
    return { content: result };
  },
};

export const visionTools: MCPTool[] = [visionAnalyzeTool, visionExtractTextTool, visionCompareTool];
