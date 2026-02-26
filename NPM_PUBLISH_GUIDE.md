# Publishing Relay to npm

## Prerequisites

1. **npm account**: Create at https://www.npmjs.com/signup
2. **Email verified**: Check your email and verify

## Step-by-Step Publishing

### 1. Login to npm

```bash
cd /Users/jevaughnstewart/Relay
npm login
```

You'll be prompted for:
- Username
- Password
- Email
- One-time password (if 2FA enabled)

### 2. Check Package Name Availability

```bash
npm search relay-protocol
```

If name is taken, update `package.json`:
```json
{
  "name": "@your-username/relay-protocol",  // Scoped package
  "version": "0.1.0"
}
```

### 3. Build Everything

```bash
npm run build
```

Verify dist/ folder has compiled JavaScript:
```bash
ls -la dist/src/
```

You should see:
- cli/
- sdk/
- adapters/
- index.js
- index.d.ts

### 4. Test Locally First

```bash
# Link package locally
npm link

# Test in another directory
cd /Users/jevaughnstewart/Pocket-Staff
npm link relay-protocol

# Try importing
node -e "const { quickConnect } = require('relay-protocol'); console.log(quickConnect)"

# Unlink when done
npm unlink relay-protocol
cd /Users/jevaughnstewart/Relay
npm unlink
```

### 5. Dry Run (See What Will Be Published)

```bash
npm publish --dry-run
```

This shows:
- Files that will be included
- Package size
- Any warnings

Check the output carefully! Make sure:
- ✅ dist/ folder is included
- ✅ package.json is included
- ✅ README is included
- ❌ src/ folder is NOT included (we ship compiled code)
- ❌ node_modules/ is NOT included

### 6. Publish to npm!

```bash
npm publish
```

If using scoped package (@username/package):
```bash
npm publish --access public
```

### 7. Verify It Worked

```bash
# Check on npmjs.com
open https://www.npmjs.com/package/relay-protocol

# Or search
npm search relay-protocol

# Try installing
npm install relay-protocol -g
relay --help
```

---

## Update Package (Future Versions)

When you make changes:

### 1. Update Version

```bash
# Patch (0.1.0 → 0.1.1) - Bug fixes
npm version patch

# Minor (0.1.0 → 0.2.0) - New features
npm version minor

# Major (0.1.0 → 1.0.0) - Breaking changes
npm version major
```

This automatically:
- Updates package.json version
- Creates a git tag
- Commits the change

### 2. Rebuild and Republish

```bash
npm run build
npm publish
```

### 3. Push to GitHub

```bash
git push
git push --tags
```

---

## Common Issues

### Issue: "Package name already exists"

**Solution**: Use scoped package

```json
{
  "name": "@your-username/relay-protocol"
}
```

Then publish with:
```bash
npm publish --access public
```

### Issue: "403 Forbidden"

**Solution**: You're not logged in

```bash
npm whoami  # Check if logged in
npm login   # If not logged in
```

### Issue: "Files missing in published package"

**Solution**: Check .npmignore

```bash
npm publish --dry-run  # See what will be included
```

Make sure .npmignore doesn't exclude dist/

### Issue: "Module not found when users install"

**Solution**: Check package.json main/types fields

```json
{
  "main": "dist/src/index.js",     // ← Must exist
  "types": "dist/src/index.d.ts"   // ← Must exist
}
```

---

## Best Practices

### 1. Semantic Versioning

- **0.1.0 → 0.1.1**: Bug fixes (patch)
- **0.1.0 → 0.2.0**: New features, backward compatible (minor)
- **0.1.0 → 1.0.0**: Breaking changes (major)

### 2. Changelog

Create CHANGELOG.md:

```markdown
# Changelog

## [0.1.1] - 2024-03-15
### Fixed
- Dashboard timing issue
- TypeScript errors in adapters

## [0.1.0] - 2024-03-14
### Added
- Initial release
- Quick connect for easy agent integration
- BaseAdapter for advanced use cases
```

### 3. Git Tags

npm version creates git tags automatically:

```bash
npm version patch  # Creates tag v0.1.1
git push --tags    # Push to GitHub
```

GitHub releases will show version history!

---

## Package Maintenance

### Unpublish (Use with Caution!)

You can only unpublish within 72 hours:

```bash
npm unpublish relay-protocol@0.1.0  # Specific version
npm unpublish relay-protocol --force  # Entire package (dangerous!)
```

**Warning**: Unpublishing is permanent and breaks others' projects!

### Deprecate Instead

Better approach for old versions:

```bash
npm deprecate relay-protocol@0.1.0 "Please upgrade to 0.2.0"
```

---

## Your First Publish Checklist

- [ ] Logged into npm: `npm login`
- [ ] Package name available (or use scoped name)
- [ ] Built: `npm run build`
- [ ] Tested locally: `npm link`
- [ ] Dry run looks good: `npm publish --dry-run`
- [ ] README.md updated
- [ ] Version is correct in package.json
- [ ] Ready to publish: `npm publish`
- [ ] Verified: Visit https://www.npmjs.com/package/relay-protocol
- [ ] Test install: `npm install -g relay-protocol`

---

## After Publishing

Users can now:

```bash
npm install -g relay-protocol
relay start
```

Or in their projects:

```bash
npm install relay-protocol
```

```typescript
import { quickConnect, Relay } from 'relay-protocol';
```

**Congratulations! Your package is live! 🎉**
