/**
 * Built-in Relay Starter Agents
 *
 * These agents ship with Relay to provide immediate functionality
 * and solve the "empty marketplace" problem.
 */

export { startWebSearchAgent } from './web-search-agent';
export { startCalculatorAgent } from './calculator-agent';
export { startTimeAgent } from './time-agent';
export { startFileAgent } from './file-agent';

export const STARTER_AGENTS = [
  {
    name: 'web-search',
    displayName: 'Web Search Agent',
    description: 'Search the web for information',
    port: 8101,
    capabilities: ['web_search', 'search_web', 'google_search'],
    starter: 'startWebSearchAgent',
  },
  {
    name: 'calculator',
    displayName: 'Calculator Agent',
    description: 'Perform mathematical calculations',
    port: 8102,
    capabilities: ['calculate', 'math', 'compute', 'evaluate'],
    starter: 'startCalculatorAgent',
  },
  {
    name: 'time',
    displayName: 'Time Agent',
    description: 'Get current time and date information',
    port: 8103,
    capabilities: ['get_time', 'get_date', 'current_time', 'timezone'],
    starter: 'startTimeAgent',
  },
  {
    name: 'file',
    displayName: 'File Agent',
    description: 'Basic file system operations',
    port: 8104,
    capabilities: ['read_file', 'write_file', 'list_directory', 'file_exists'],
    starter: 'startFileAgent',
  },
] as const;
