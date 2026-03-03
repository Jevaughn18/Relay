/**
 * File Agent - Basic file system operations
 *
 * Usage: relay agents start file
 */

import { quickConnect } from '../sdk/index';
import * as fs from 'fs/promises';
import * as path from 'path';

export function startFileAgent() {
  quickConnect({
    name: 'FileAgent',
    capabilities: ['read_file', 'write_file', 'list_directory', 'file_exists'],
    port: 8104,
    handler: async (task: string, params: Record<string, any>) => {
      if (task === 'read_file') {
        const filePath = params.path || params.file || '';

        if (!filePath) {
          throw new Error('File path parameter is required');
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const stats = await fs.stat(filePath);

          return {
            path: filePath,
            content,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        } catch (error: any) {
          throw new Error(`Failed to read file: ${error.message}`);
        }
      }

      if (task === 'write_file') {
        const filePath = params.path || params.file || '';
        const content = params.content || params.data || '';

        if (!filePath) {
          throw new Error('File path parameter is required');
        }

        try {
          await fs.writeFile(filePath, content, 'utf-8');
          const stats = await fs.stat(filePath);

          return {
            path: filePath,
            size: stats.size,
            written: new Date().toISOString(),
          };
        } catch (error: any) {
          throw new Error(`Failed to write file: ${error.message}`);
        }
      }

      if (task === 'list_directory') {
        const dirPath = params.path || params.directory || '.';

        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          const items = await Promise.all(
            entries.map(async (entry) => {
              const fullPath = path.join(dirPath, entry.name);
              const stats = await fs.stat(fullPath);

              return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modified: stats.mtime.toISOString(),
              };
            })
          );

          return {
            path: dirPath,
            items,
            count: items.length,
          };
        } catch (error: any) {
          throw new Error(`Failed to list directory: ${error.message}`);
        }
      }

      if (task === 'file_exists') {
        const filePath = params.path || params.file || '';

        if (!filePath) {
          throw new Error('File path parameter is required');
        }

        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);

          return {
            path: filePath,
            exists: true,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
          };
        } catch {
          return {
            path: filePath,
            exists: false,
          };
        }
      }

      throw new Error(`Unknown task: ${task}`);
    },
  });

  console.log('✅ FileAgent started - Managing files!');
}

// Allow running directly
if (require.main === module) {
  startFileAgent();
}
