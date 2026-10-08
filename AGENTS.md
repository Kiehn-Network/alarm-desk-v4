# Architecture rules

- Keep all badge templates in the shared AusweisDesign configuration and render both sides through the existing badge components; previews and print output must stay identical.
- Store custom badge logos in the existing design configuration as resized PNG data URLs; this preserves transparency and uses the same tenant-protected persistence as other design fields.