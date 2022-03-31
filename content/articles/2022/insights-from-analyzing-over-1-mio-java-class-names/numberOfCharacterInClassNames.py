import numpy as np
import matplotlib.pyplot as plt

plt.figure(figsize=(5.5, 4))

y = np.array([1572,1842,6128,14646,14679,19432,25300,37904,42768,48477,56381,62224,65604,67791,76213,69267,68672,67184,65101,59709,56416,53112,47407,43028,38674,34133,30572,27036,23386,20370,17620,15161,13273,11302,9851,8186,7058,5995,5037,4494,3922,3216,3013,2371,2020,1764,1517,1309,1103,1010,817,698,622,454,433,358,290,282,223,166,161,124])
x = np.arange(1, len(y)+1, 1)

plt.bar(x,y, color='#061332', width=0.9)
plt.title('Number of Characters in Class Names')
plt.xlabel('Class name length')
plt.ylabel('Occurrences')
plt.xticks(np.arange(1, len(x) - 1, 3), rotation=45)
plt.tight_layout()
plt.savefig("numberOfCharacterInClassNames.svg")