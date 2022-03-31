import numpy as np
import matplotlib.pyplot as plt

plt.figure(figsize=(5,3.5))

y = [13504,25659,4542,1474,26158,14924,9174,2318,926,254,83,82]
x = np.arange(1, len(y)+1, 1)

plt.bar(x,y, color='#061332', width=0.9)
plt.title('Number of Subpackages in Class Names')
plt.xlabel('Subpackages in class names')
plt.ylabel('Occurrences')
plt.xticks(np.arange(1, len(x) + 1, 1), rotation=0)
plt.tight_layout()
plt.savefig("numberOfSubpackagesInClassNames.svg")