"""
Coffee shop management module.

Functions in this file are intentionally aligned with BPMN tasks:
- Take order
- Process payment
- Prepare pastry
- Serve customer
- Generate daily report
"""

from typing import Dict, List




def process_payment(order: Dict, method: str) -> bool:
    """Process payment: Process customer payment using cash or card."""
    if method not in ("cash", "card"):
        return False
    order["paid"] = True
    return True



def prepare_pastry(pastry: str) -> str:
    """Prepare pastry: Prepare and warm pastries requested by the customer."""
    return f"Prepared {pastry}"


def serve_customer(order: Dict) -> str:
    """Serve customer: Serve coffee and pastries to the customer."""
    return f"Served {order.get('customer')}"


def generate_daily_report(orders: List[Dict]) -> Dict:
    """Generate daily report: Generate daily sales and orders report for the coffee shop."""
    return {
        "total_orders": len(orders),
        "total_items": sum(len(o.get("items", [])) for o in orders),
    }
