---
layout: base.njk
title: "Sciris: Simplifying scientific software in Python"
hero: Simplifying scientific software in Python
nav:
  - [What?, "#what"]
  - [Why?, "#why"]
  - [Install, "#installation"]
  - [Examples, "#examples"]
  - [Features, "#features"]
  - [Used by, "#usedby"]
  - [Cite, "#citation"]
  - [Contact, "#contact"]
footer_left: |
  © 2014–2026 by the Sciris Development Team

  Sciris is developed by the [Institute for Disease Modeling](https://idmod.org), the [Burnet Institute](https://burnet.edu.au), and other collaborators.

  [Docs](https://docs.sciris.org) | [GitHub](https://github.com/sciris/sciris) | [PyPI](https://pypi.org/project/sciris) | [Paper](https://doi.org/10.21105/joss.05076)
footer_right: |
  Sciris is distributed under the MIT License. It is used in production by a number of scientific software projects, but we make no representations that it will suit your needs, and we cannot promise support. You are welcome to [fork it](https://github.com/sciris/sciris/fork) and adapt it as permitted under the license.
---

{% section "what", "What is Sciris?" %}
Sciris is a library of tools that make writing scientific Python code easier and more pleasant. Built on top of [NumPy](https://numpy.org) and [Matplotlib](https://matplotlib.org), it provides functions covering a wide range of common math, file I/O, and plotting operations, so you can get more done with less code. It was originally written to help epidemiologists and neuroscientists focus on doing science rather than on writing code, but it is applicable across scientific domains (and some nonscientific ones too).

Sciris does not replace the libraries it builds on. It sits on top of them as a "library of the gaps", addressing annoyances that are each too small to need a dedicated library of their own, but common enough that together they add up to a significant coding burden.
{% endsection %}

{% topbuttons %}
{% topbtn "Docs", "https://docs.sciris.org", "octicons/code" %}
{% topbtn "Tutorials", "https://docs.sciris.org/tutorials.html", "fontawesome/lightbulb-o", "tight" %}
{% topbtn "Code", "https://github.com/sciris/sciris", "octicons/mark-github" %}
{% topbtn "Paper", "https://doi.org/10.21105/joss.05076", "octicons/book" %}
{% topbtn "AI", "https://context7.com/sciris/sciris", "octicons/north-star" %}
{% endtopbuttons %}

{% cards "why", "Why Sciris?" %}
{% card "Brevity", "flash" %}
Sciris packages common patterns that require multiple lines of code into single, simple functions: `sc.parallelize()` to run a function across CPUs, `sc.save()` and `sc.load()` for arbitrary Python objects, `sc.surf3d()` for a 3D plot. Less code to write means less code to debug.
{% endcard %}
{% card "Plain names", "eye" %}
Functions are named after what they do, not after how they do it: `sc.smooth()`, `sc.findnearest()`, `sc.safedivide()`. Some names (`sc.tic()`, `sc.toc()`, `sc.boxoff()`) will look familiar if you have used MATLAB.
{% endcard %}
{% card "Forgiving defaults", "life-ring" %}
Many Sciris functions take a `die` argument, so you can choose how strict you want to be. With `die=False`, Sciris warns and returns `None` so you can decide what to do next; with `die=True`, it raises. Either way, you write fewer try/except blocks.
{% endcard %}
{% endcards %}

{% section "installation", "Installation" %}
Sciris requires Python 3.9 or later, and has no dependencies beyond the usual scientific Python stack.

```bash
pip install sciris          # using pip
uv add sciris               # using uv
conda install -c conda-forge sciris   # using conda
```

Then:

```python
import sciris as sc
```

Doing science is left as an exercise to the reader.
{% endsection %}

{% examples %}
{% tab "Containers", "" %}
`sc.odict` is a flexible container representing an associative array, with the best-of-all-worlds features of lists, dictionaries, and numeric arrays. It is based on `OrderedDict`, but supports integer indexing, key slicing, and item insertion. `sc.objdict` is the same, but also allows attribute-style access:

```python
data = sc.objdict(a=[1,2,3], b=[4,5,6])

assert data.a == data['a'] == data[0]  # Refer to items by attribute, key, or index
assert data[:].sum() == 21             # You can sum a dict

for i, key, value in data.enumitems():
    print(f'Item {i} is named "{key}" and has value {value}')

# Item 0 is named "a" and has value [1, 2, 3]
# Item 1 is named "b" and has value [4, 5, 6]
```

To take a based-on-a-true-story example: if `results` is a dictionary of model runs, and each run is a dictionary with a `data` key, then getting the data from the first run is `results[list(results.keys())[0]]['data']` with plain dictionaries, and `results[0].data` with an `objdict`.
{% endtab %}

{% tab "Arrays", "" %}
Indexing arrays is a common task in NumPy, but it can be awkward when types do not quite match: floats versus integers, lists versus arrays. `sc.findinds()` finds matches anyway, and accepts multiple conditions:

```python
sc.findinds([2,3,6,3], 3.0)  # Returns array([1, 3])

v = np.random.rand(100)
sc.findinds(v>0.4, v<0.6)    # Indices where both conditions hold
```

The first line is equivalent to `np.nonzero(np.isclose(arr, val))[0]`, and the second to `((v>0.4)*(v<0.6)).nonzero()[0]`. Related functions include `sc.findnearest()` (nearest value, whether or not it matches exactly), `sc.findfirst()`, `sc.findlast()`, and `sc.smooth()`.
{% endtab %}

{% tab "Files", "" %}
`sc.save()` and `sc.load()` handle arbitrary Python objects, including your own classes, so you can stop an analysis and pick it up later:

```python
sc.save('results.obj', results)   # Save any Python object
results = sc.load('results.obj')  # Load it back
```

If you want a specific format, there is a function for that too: `sc.savejson()`, `sc.loadjson()`, `sc.savetext()`, `sc.loadyaml()`, `sc.dataframe.read_csv()`. And if you want to know later what produced a file, `sc.savearchive()` and `sc.savefig()` store the date, Python environment, and Git commit alongside the data or the figure, which `sc.loadarchive()` and `sc.loadmetadata()` read back.
{% endtab %}

{% tab "Parallelization", "" %}
Scientific workflows are often [embarrassingly parallel](https://en.wikipedia.org/wiki/Embarrassingly_parallel), yet parallelizing them can still be a hurdle. `sc.parallelize()` is a shortcut to `multiprocess.Pool()` that accepts arguments in whichever form is most convenient:

```python
def f(x, y):
    return x*y

out1 = sc.parallelize(f, iterarg=[(1,2), (2,3), (3,4)])
out2 = sc.parallelize(f, iterkwargs={'x':[1,2,3], 'y':[2,3,4]})
out3 = sc.parallelize(f, iterkwargs=[{'x':1, 'y':2},
                                     {'x':2, 'y':3},
                                     {'x':3, 'y':4}])
```

All three return `[2, 6, 12]`. By default the pool size is set from the number of CPUs available, but you can fix it, or allocate dynamically based on current load with `sc.loadbalancer()`.
{% endtab %}

{% tab "Plotting", "assets/img/example-plotting.png" %}
Sciris includes shortcuts for the parts of Matplotlib that are more fiddly than they need to be — date axes, tick formatting, mapping values onto colors:

```python
sc.options(font='Raleway')                       # Set a custom font
x = sc.daterange('2022-06-01', '2022-12-31', as_date=True)  # Create dates
y = sc.smooth(np.random.rand(len(x))**2)*1000    # Create smoothed random numbers
c = sc.vectocolor(y, cmap='turbo')               # Set colors proportional to y

plt.scatter(x, y, c=c)  # Vanilla Matplotlib
sc.dateformatter()      # Automatic date formatting on the x-axis
sc.commaticks()         # Write 1000 as 1,000 rather than 1e3
sc.setylim()            # Set the y-axis to start at zero
sc.boxoff()             # Remove the top and right axis spines
```
{% endtab %}

{% tab "Side by side", "assets/img/sciris-showcase-code.png" %}
Below are two functionally identical scripts: one written in plain Python (left), one using Sciris (right). Both sample random numbers from a user-defined function at several noise levels, save the intermediate results to disk, load them back, plot them in 3D, and report the elapsed time. The plain Python version takes about twice as many lines in total; counting only the lines that differ, and excluding comments and whitespace, it takes 33 where Sciris takes 7.
{% endtab %}

{% tab "Output", "assets/img/sciris-showcase-output.png" %}
This is the output of the two scripts in the previous tab: plain Python on the left, Sciris on the right. The plots are identical apart from the colormap, which is one of several new ones that Sciris adds.
{% endtab %}
{% endexamples %}

{% section "features", "What's in it", "wide" %}
A selection of the most commonly used functions. The [API reference](https://docs.sciris.org/api/) has the rest.

{% columns %}
{% column %}
#### Containers

- `sc.odict()`: dictionary that also acts like a list and an array
- `sc.objdict()`: an odict that supports `foo.bar` as well as `foo['bar']`
- `sc.dataframe()`: a pandas DataFrame with extra conveniences

#### Math and arrays

- `sc.findinds()`, `sc.findnearest()`, `sc.findfirst()`, `sc.findlast()`: locate values in an array
- `sc.smooth()`: smooth 1D or 2D arrays
- `sc.tolist()`, `sc.toarray()`: turn any object into a list or array
- `sc.asd()`: adaptive stochastic descent, for optimizing noisy functions

#### Files and versioning

- `sc.save()`, `sc.load()`: save and load any Python object
- `sc.savejson()`, `sc.loadjson()`, `sc.loadyaml()`: likewise, for structured text
- `sc.thisdir()`, `sc.getfilelist()`: find your way around the filesystem
- `sc.savearchive()`, `sc.compareversions()`, `sc.require()`: keep track of what ran where

#### Printing

- `sc.pr()`: print everything an object contains, including attributes and methods
- `sc.heading()`, `sc.printbold()`, `sc.colorize()`: readable terminal output
- `sc.sigfig()`: round a number to a given number of significant figures
- `sc.progressbar()`: show progress through a loop
{% endcolumn %}
{% column %}
#### Plotting

- `sc.vectocolor()`, `sc.gridcolors()`: map continuous or categorical data onto colors
- `sc.dateformatter()`, `sc.commaticks()`, `sc.SIticks()`: readable axis labels
- `sc.plot3d()`, `sc.surf3d()`: 3D plots that work the first time
- `sc.savefig()`, `sc.savemovie()`: save figures with metadata, or as a movie

#### Parallelization and profiling

- `sc.parallelize()`: run a function many times across many CPUs
- `sc.loadbalancer()`: allocate CPUs based on current load
- `sc.timer()`, `sc.tic()`, `sc.toc()`: time how long things take
- `sc.profile()`: line-by-line profiling, without the setup

#### Other utilities

- `sc.date()`, `sc.daterange()`, `sc.readdate()`: dates, from most formats you might have
- `sc.dcp()`: deep-copy an object (and `sc.robust_dcp()` for when that fails)
- `sc.search()`, `sc.equal()`: find things in, or compare, deeply nested objects
- `sc.help()`: full-text search of the Sciris source code
{% endcolumn %}
{% endcolumns %}
{% endsection %}

{% section "usedby", "Where Sciris is used" %}
Work on Sciris began in 2014, to support development of the [Optima](http://optimamodel.com) suite of models. We kept running into the same inconveniences while building scientific webapps, and started collecting the tools we used to get around them into a shared library.

That investment paid off in early 2020, when Sciris' brevity and simplicity helped enable the rapid development of [Covasim](https://covasim.org), a COVID-19 model that went on to be used by students, researchers, and policymakers in over 30 countries. Sciris is now a dependency of a number of scientific software projects, including [Starsim](https://starsim.org), [Atomica](http://atomica.tools), [FPsim](https://fpsim.org), [SynthPops](https://github.com/InstituteforDiseaseModeling/synthpops), and [ScirisWeb](https://github.com/sciris/scirisweb), which provides the backend for webapps such as the [Cascade Analysis Tool](http://cascade.tools).

Sciris is not a product of any one project, and it does not assume anything about your domain. If it saves you some typing, it is doing its job.

(The name, incidentally, is a portmanteau of "scientific" and "iris" — a reference to seeing clearly, and to the Greek word for "rainbow.")
{% endsection %}

{% section "citation", "Citing Sciris" %}
Sciris is described in the following paper, published in the *Journal of Open Source Software*:

{% cite %}
Kerr CC, Sanz-Leon P, Abeysuriya RG, Chadderdon GL, Harbuz VS, Saidi P, Quiroga MM, Martin-Hughes R, Kelly SL, Cohen JA, Stuart RM, Nachesa A. **Sciris: Simplifying scientific software in Python.** *Journal of Open Source Software* 2023; **8**(88):5076. DOI: [10.21105/joss.05076](https://doi.org/10.21105/joss.05076).
{% endcite %}

The citation is also available in [BibTeX format](https://github.com/sciris/sciris/raw/main/docs/sciris-citation.bib).
{% endsection %}

{% section "contact", "Contact" %}
Sciris is developed in the open on [GitHub](https://github.com/sciris/sciris), and contributions are welcome — see the [contributing guide](https://docs.sciris.org/contributing.html) to get started. If you find a bug or want a feature, please [open an issue](https://github.com/sciris/sciris/issues/new/choose).

If you have questions, or would like some help getting started, email us at [info@sciris.org](mailto:info@sciris.org).

Sciris also has [MCP servers](https://modelcontextprotocol.io) on [Context7](https://context7.com/sciris/sciris) and [GitMCP](https://gitmcp.io/sciris/sciris), plus a [Claude Code](https://code.claude.com/docs/en/overview) plugin covering all of its features: add <https://github.com/sciris/sciris> as a marketplace, then install the plugin from there.
{% endsection %}
