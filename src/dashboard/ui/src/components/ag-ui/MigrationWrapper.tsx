/**
 * Migration Wrapper
 *
 * Allows gradual migration from legacy components to AG-UI components
 */

import React from 'react';
import { useAGUIEnabled } from '../../providers/AGUIProvider';

interface MigrationWrapperProps {
  /** Legacy component to show when AG-UI is disabled */
  legacy: React.ComponentType<any>;
  /** AG-UI component to show when AG-UI is enabled */
  agui: React.ComponentType<any>;
  /** Props to pass to both components */
  props?: any;
  /** Force AG-UI mode even if not connected (for testing) */
  forceAGUI?: boolean;
}

/**
 * Migration Wrapper Component
 *
 * Renders either legacy or AG-UI component based on AG-UI availability
 */
export function MigrationWrapper({
  legacy: LegacyComponent,
  agui: AGUIComponent,
  props = {},
  forceAGUI = false,
}: MigrationWrapperProps) {
  const aguiEnabled = useAGUIEnabled();

  const Component = (forceAGUI || aguiEnabled) ? AGUIComponent : LegacyComponent;

  return <Component {...props} />;
}
