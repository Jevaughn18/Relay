/**
 * AI Wrapper Types - Explicit Relay Integration
 */

export interface RelayConfig {
  /**
   * Agent ID for this application
   */
  agentId: string;

  /**
   * Delegation approval mode
   * - 'ask': Pause and ask user for approval on each delegation (default, safest)
   * - 'auto': Auto-approve delegations within constraints
   */
  mode?: 'ask' | 'auto';

  /**
   * Maximum credits to spend per delegation
   */
  maxSpend?: number;

  /**
   * For 'auto' mode: Pre-approved capabilities that can auto-delegate
   * Example: ['web_search', 'calculator']
   */
  autoApprove?: string[];

  /**
   * Registry URL (defaults to localhost:9001)
   */
  registryUrl?: string;

  /**
   * Callback when delegation is requested
   * Return true to approve, false to deny
   */
  onDelegation?: (task: DelegationRequest) => Promise<boolean> | boolean;

  /**
   * Callback when delegation completes
   */
  onComplete?: (task: DelegationRequest, result: any) => void;

  /**
   * Callback when delegation fails
   */
  onError?: (task: DelegationRequest, error: Error) => void;

  /**
   * Show user notifications (default: true)
   */
  notify?: boolean;
}

export interface DelegationRequest {
  /**
   * Capability being requested (e.g., 'book_flight')
   */
  capability: string;

  /**
   * Task parameters
   */
  params: Record<string, any>;

  /**
   * Estimated cost in credits
   */
  estimatedCost: number;

  /**
   * Agent that will handle the task
   */
  agentName?: string;

  /**
   * Agent ID that will handle the task
   */
  agentId?: string;
}

export interface DelegationResult {
  success: boolean;
  result?: any;
  error?: string;
  cost: number;
  agentId: string;
  agentName: string;
}
