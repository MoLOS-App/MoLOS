# Release v0.2.0 - Module Activation in Welcome Flow

**Release Date**: 2026-03-09  
**Type**: Minor Release (New Feature)

## 🎉 Highlights

This release introduces a significant enhancement to the new user onboarding experience. New users can now personalize their workspace by selecting which modules to activate during the initial setup process.

## ✨ What's New

### Module Activation in Welcome Flow

**New Onboarding Step**: "Customize your workspace"

- Users can now choose which modules to activate during initial setup
- Recommended defaults are pre-selected for convenience
- Mandatory core modules (dashboard, ai) are clearly marked as "Always Active"
- Clean, accessible interface with toggle controls

**Default Module Selection**:

- ✅ Dashboard (Always Active)
- ✅ AI (Always Active)
- ✅ MoLOS-Tasks (Pre-selected)
- ✅ MoLOS-Markdown (Pre-selected)
- Optional: Goals, Health, Finance, Meals, Google, AI-Knowledge

### New Components

1. **API Endpoint**: `/api/settings/external-modules/activate-bulk`
   - Bulk module activation during welcome flow
   - Validates minimum required modules
   - Robust authentication and error handling

2. **UI Components**:
   - `ModuleCard`: Individual module card with toggle control
   - `ModuleGrid`: Responsive grid layout for module selection
   - Full accessibility support (ARIA labels, keyboard navigation)

3. **Server Action**: `activateModules`
   - Handles form submission from welcome flow
   - Validates user authentication
   - Activates modules with proper error handling

### Quality Assurance

- **136 comprehensive test cases** covering:
  - API endpoint functionality
  - Server action behavior
  - UI component rendering
  - Integration scenarios
  - Edge cases and error handling

## 🚀 User Impact

**New Users**:

- Enhanced onboarding experience
- Personalized workspace from day one
- Clear understanding of available modules
- Better control over initial setup

**Existing Users**:

- No changes to current workflow
- Module activation still available through Settings
- Existing modules remain active

## 🔧 Technical Details

- **Frontend**: Svelte 5 with runes ($state, $props, $derived)
- **Backend**: SvelteKit server actions and API routes
- **Design**: Follows existing MoLOS patterns
- **Database**: No schema changes required
- **Testing**: Comprehensive test suite (136 test cases)

## 📦 Installation

### Docker (Recommended)

```bash
docker pull ghcr.io/molos-app/molos:v0.2.0
docker run -d -p 4173:4173 -v ./data:/data --name molos ghcr.io/molos-app/molos:v0.2.0
```

### From Source

```bash
git clone https://github.com/MoLOS-App/MoLOS.git
cd MoLOS
git checkout v0.2.0
bun install
bun run build:prod
bun run serve
```

## 🔄 Upgrade Notes

- **No database migrations required**
- **No breaking changes**
- **Existing configurations preserved**
- **Existing users unaffected**

## 📋 Changelog

### Added

- Module activation step in welcome flow
- Bulk module activation API endpoint
- ModuleCard and ModuleGrid UI components
- Comprehensive test suite (136 tests)

### Changed

- Enhanced onboarding user experience
- Improved module selection interface

### Technical

- Svelte 5 runes implementation
- Accessibility improvements
- Error handling enhancements

## 🐛 Bug Fixes

No bug fixes in this release.

## 🔒 Security

No security changes in this release.

## 📚 Documentation

- Updated user documentation for welcome flow
- Added component documentation
- Test documentation for new features

## 🙏 Contributors

Thanks to all contributors who made this release possible!

## 📝 Full Changelog

See [CHANGELOG.md](./CHANGELOG.md) for complete details.

---

**Previous Release**: [v0.1.0](https://github.com/MoLOS-App/MoLOS/releases/tag/v0.1.0)  
**Next Release**: TBD
