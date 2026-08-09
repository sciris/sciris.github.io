"""
Generate the plotting example image used on the Sciris website.
"""
import numpy as np
import sciris as sc
import matplotlib.pyplot as plt

sc.options(font='Raleway')
x = sc.daterange('2022-06-01', '2022-12-31', as_date=True) # Create dates
y = sc.smooth(np.random.rand(len(x))**2)*1000 # Create smoothed random numbers
c = sc.vectocolor(y, cmap='turbo') # Set colors proportional to y values

plt.figure(figsize=(8,4))
plt.scatter(x, y, c=c) # Plot the data
sc.dateformatter() # Automatic x-axis date formatter
sc.commaticks() # Add commas to y-axis tick labels
sc.setylim() # Automatically set the y-axis limits
sc.boxoff() # Remove the top and right axis spines

sc.savefig(sc.thispath(__file__) / 'example-plotting.png', dpi=150, bbox_inches='tight')
