from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Campus(Base):
    __tablename__ = "campuses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    campus_code = Column(String(50), unique=True, nullable=False, index=True)
    location = Column(String(255), nullable=False)
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="campus")
    outlets = relationship("Outlet", back_populates="campus")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=False)
    user_category = Column(String(30), nullable=False)  # STUDENT, FACULTY, NON_TEACHING_STAFF
    operational_role = Column(String(30), default="USER", nullable=False)  # USER, ADMIN, VENDOR, OUTLET_STAFF
    account_status = Column(String(20), default="ACTIVE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campus = relationship("Campus", back_populates="users")
    orders = relationship("Order", back_populates="user")
    reservations = relationship("Reservation", back_populates="user")

class Outlet(Base):
    __tablename__ = "outlets"
    id = Column(Integer, primary_key=True, index=True)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=False)
    outlet_name = Column(String(150), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=False)
    opening_time = Column(String(10), default="08:00")
    closing_time = Column(String(10), default="20:00")
    outlet_status = Column(String(20), default="ACTIVE")
    crowd_level = Column(String(20), default="LOW")
    avg_wait_min = Column(Integer, default=10)
    vendor_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campus = relationship("Campus", back_populates="outlets")
    categories = relationship("MenuCategory", back_populates="outlet", cascade="all, delete-orphan")
    menu_items = relationship("MenuItem", back_populates="outlet", cascade="all, delete-orphan")
    tables = relationship("OutletTable", back_populates="outlet", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="outlet")

class OutletStaff(Base):
    __tablename__ = "outlet_staff"
    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    staff_role = Column(String(30), default="STAFF")
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("outlet_id", "user_id", name="uq_outlet_user"),)

class MenuCategory(Base):
    __tablename__ = "menu_categories"
    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False)
    category_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    outlet = relationship("Outlet", back_populates="categories")
    menu_items = relationship("MenuItem", back_populates="category")

class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("menu_categories.id"), nullable=False)
    item_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    image_url = Column(String(500), nullable=False)
    food_type = Column(String(20), nullable=False)  # VEG, NON_VEG, EGG
    dietary_tags = Column(Text, default="[]")
    allergens = Column(Text, default="[]")
    preparation_time = Column(Integer, default=10)
    availability_status = Column(String(20), default="AVAILABLE")
    stock_quantity = Column(Integer, default=100)
    display_order = Column(Integer, default=0)
    rating = Column(Float, default=4.8)
    is_popular = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    outlet = relationship("Outlet", back_populates="menu_items")
    category = relationship("MenuCategory", back_populates="menu_items")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    idempotency_key = Column(String(100), unique=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=False)
    subtotal = Column(Float, nullable=False)
    taxes = Column(Float, default=0.0)
    discounts = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    payment_status = Column(String(30), default="PENDING")
    order_status = Column(String(30), default="PLACED")  # PLACED, ACCEPTED, PREPARING, READY, COMPLETED, CANCELLED
    pickup_token = Column(String(50), nullable=False)
    pickup_counter = Column(String(50), default="COUNTER 01")
    pickup_type = Column(String(20), default="immediate")
    scheduled_time = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    outlet = relationship("Outlet", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False, cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    item_name_snapshot = Column(String(150), nullable=False)
    unit_price_snapshot = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    selected_options = Column(Text, default="{}")
    item_total = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    payment_provider = Column(String(50), default="SANDBOX_UPI")
    payment_reference = Column(String(100), unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), nullable=False)
    payment_status = Column(String(30), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="payment")

class OutletTable(Base):
    __tablename__ = "outlet_tables"
    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False)
    table_number = Column(String(20), nullable=False)
    capacity = Column(Integer, nullable=False)
    location = Column(String(150), nullable=False)
    status = Column(String(20), default="available")
    created_at = Column(DateTime, default=datetime.utcnow)

    outlet = relationship("Outlet", back_populates="tables")
    reservations = relationship("Reservation", back_populates="table", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("outlet_id", "table_number", name="uq_outlet_table"),)

class Reservation(Base):
    __tablename__ = "reservations"
    id = Column(Integer, primary_key=True, index=True)
    reservation_number = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=False)
    table_id = Column(Integer, ForeignKey("outlet_tables.id", ondelete="CASCADE"), nullable=False)
    reservation_date = Column(String(20), nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    party_size = Column(Integer, nullable=False)
    reservation_status = Column(String(20), default="CONFIRMED")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="reservations")
    table = relationship("OutletTable", back_populates="reservations")

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    rating = Column(Integer, nullable=False)
    review_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class MediaAsset(Base):
    __tablename__ = "media_assets"
    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=True)
    media_type = Column(String(20), default="IMAGE")
    media_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    alt_text = Column(String(255), nullable=True)
    title = Column(String(150), nullable=True)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
