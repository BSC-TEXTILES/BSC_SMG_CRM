with open(r'D:\BTPL_SMG\BSC_SMG\frontend\src\pages\VmChecklist.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace literal < with < (HTML entity)
content = content.replace('Failed (<80%)', 'Failed (<80%)')

with open(r'D:\BTPL_SMG\BSC_SMG\frontend\src\pages\VmChecklist.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')