"""Run the repository Hermes CLI with relocation helpers on its Python path."""
import runpy
runpy.run_module('hermes_cli.main', run_name='__main__')
