import numpy as np
import matplotlib.pyplot as plt

plt.figure(figsize=(5,3.5))

y = [7,111,275,393,114,330,262,294,853,678,609,669,632,1921,1166,1248,1793,1934,3535,2161,3168,2671,3172,5296,2954,2642,3127,2924,3218,3937,2510,3272,3188,2508,2585,2512,3348,2899,1772,1889,1602,1990,1279,1514,1497,760,1118,2335,1262,617,761,386,480,383,316,482,338,373,236,201,239,157,130,194,142,230,121,166,109,160]
x = np.arange(1, len(y)+1, 1)

plt.bar(x,y, color='#061332', width=0.9)
plt.title('Number of Characters in Package Names')
plt.xlabel('Package name length')
plt.ylabel('Occurrences')
plt.xticks(np.arange(1, len(x) + 1, 5), rotation=0)
plt.tight_layout()
plt.savefig("numberOfCharactersInPackageNames.svg")