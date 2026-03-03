/**
 * Calculator Agent - Mathematical computation capability
 *
 * Usage: relay agents start calculator
 */

import { quickConnect } from '../sdk/index';

export function startCalculatorAgent() {
  quickConnect({
    name: 'CalculatorAgent',
    capabilities: ['calculate', 'math', 'compute', 'evaluate'],
    port: 8102,
    handler: async (task: string, params: Record<string, any>) => {
      if (task === 'calculate' || task === 'math' || task === 'compute' || task === 'evaluate') {
        const expression = params.expression || params.expr || params.formula || '';

        if (!expression) {
          throw new Error('Expression parameter is required');
        }

        try {
          // Safe math evaluation - only allow numbers and basic operators
          const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');

          if (sanitized !== expression) {
            throw new Error('Invalid characters in expression. Only numbers and operators (+, -, *, /, %, .) allowed.');
          }

          // Evaluate using Function constructor (safer than eval for math)
          const result = new Function(`return ${sanitized}`)();

          return {
            expression: expression,
            sanitized: sanitized,
            result: result,
            timestamp: new Date().toISOString(),
          };
        } catch (error: any) {
          throw new Error(`Calculation error: ${error.message}`);
        }
      }

      throw new Error(`Unknown task: ${task}`);
    },
  });

  console.log('✅ CalculatorAgent started - Ready to compute!');
}

// Allow running directly
if (require.main === module) {
  startCalculatorAgent();
}
