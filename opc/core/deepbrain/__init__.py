"""OPC DeepBrain — 6-layer self-evolving knowledge engine (embedded in OPC Agent)."""

from opc.core.deepbrain.brain import DeepBrain
from opc.core.deepbrain.ingest import ingest_directory, ingest_file
from opc.core.deepbrain.chunker import chunk_document
from opc.core.deepbrain.watch import watch_directory

__all__ = ["DeepBrain", "ingest_directory", "ingest_file", "chunk_document", "watch_directory"]
