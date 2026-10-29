# models/__init__.py
# Empty file — marks 'models/' as a Python package.
# It also imports all models so SQLAlchemy can discover them when we call
# Base.metadata.create_all(engine) in our test script.

from app.models.firm import Firm          # noqa: F401
from app.models.item import Item          # noqa: F401
from app.models.customer import Customer  # noqa: F401
from app.models.invoice import Invoice, InvoiceItem, InvoiceType, PaymentStatus  # noqa: F401
from app.models.payment import Payment, PaymentType, PaymentMode  # noqa: F401


