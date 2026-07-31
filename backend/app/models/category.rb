class Category < ApplicationRecord
  has_many :expenses, dependent: :destroy

  before_validation :normalize_name

  validates :name, presence: true, length: { maximum: 100 }, uniqueness: { case_sensitive: false }

  private

  def normalize_name
    self.name = name.strip if name
  end
end
