import numpy as np
import matplotlib.pyplot as plt

plt.figure(figsize=(5,3.5))

y = [91546,335482,385497,259854,138018,67312,30646,13791,5859,2579,1240,641,287]
x = np.arange(1, len(y)+1, 1)

plt.bar(x,y, color='#061332', width=0.9)
plt.title('Number of Words in Class Names')
plt.xlabel('Words in class names')
plt.ylabel('Occurrences')
plt.xticks(np.arange(1, len(x) + 1, 1), rotation=0)
plt.tight_layout()
plt.savefig("numberOfWordsInClassNames.svg")