import zipfile
import re
from collections import Counter

def check_vouchers():
    with zipfile.ZipFile('../accurate.zip') as z:
        v = z.read('accurate/backup/Projects/Accurate/Vouchers.atc').decode('utf-8', errors='ignore')
        
    vchtypes = re.findall(r'VCHTYPE="([^"]+)"', v)
    print("Voucher types in Vouchers.atc:")
    print(Counter(vchtypes))
    
    # Check other .atc files
    with zipfile.ZipFile('../accurate.zip') as z:
        atc_files = [f for f in z.namelist() if f.endswith('.atc')]
        print("\nAll .atc files in zip:")
        for af in atc_files:
            content = z.read(af).decode('utf-8', errors='ignore')
            types = re.findall(r'VCHTYPE="([^"]+)"', content)
            print(af, Counter(types))

if __name__ == '__main__':
    check_vouchers()
