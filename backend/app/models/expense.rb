class Expense < ApplicationRecord
  belongs_to :category

  validates :description, presence: true, length: { maximum: 255 }
  validates :amount, numericality: { greater_than: 0 }
  validates :date, presence: true
  validate :date_cannot_be_in_future

  private

  def date_cannot_be_in_future
    return if date.blank? || date <= Date.current

    errors.add(:date, "cannot be in the future")
  end
end
