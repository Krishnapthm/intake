from langgraph.graph import StateGraph, START, END

from .state import IntakeState
from .nodes import process_turn


def build_graph():
    builder = StateGraph(IntakeState)
    builder.add_node("intake_turn", process_turn)
    builder.add_edge(START, "intake_turn")
    builder.add_edge("intake_turn", END)
    return builder.compile()


intake_graph = build_graph()
